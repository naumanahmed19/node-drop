/**
 * ScheduleJobManager - Manages scheduled workflow executions using Bull Queue
 * 
 * Database-backed approach: Uses scheduled_jobs table as single source of truth.
 * Jobs are loaded from database on startup, and all operations persist to database.
 */

import Bull, { Job, Queue } from 'bull';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ExecutionService } from '../services/ExecutionService';

export interface ScheduleJobData {
    workflowId: string;
    triggerId: string;
    triggerNodeId: string;
    cronExpression: string;
    timezone: string;
    description: string;
    userId: string;
}

export interface ScheduleJobInfo {
    id: string;
    workflowId: string;
    workflowName: string;
    triggerId: string;
    cronExpression: string;
    timezone: string;
    description: string;
    nextRun: Date | null;
    lastRun: Date | null;
    status: 'active' | 'paused' | 'failed';
    failCount: number;
}

export class ScheduleJobManager {
    private scheduleQueue: Queue<ScheduleJobData>;
    private prisma: PrismaClient;
    private executionService: ExecutionService;

    constructor(
        prisma: PrismaClient,
        executionService: ExecutionService,
        redisConfig?: Bull.QueueOptions
    ) {
        this.prisma = prisma;
        this.executionService = executionService;

        // Initialize Bull queue for scheduled jobs
        this.scheduleQueue = new Bull<ScheduleJobData>('schedule-jobs', {
            redis: redisConfig?.redis || {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: false,
                removeOnFail: false,
            },
        });

        this.setupQueueProcessors();
        this.setupQueueEvents();
    }

    /**
     * Initialize - Load all active schedule jobs from database
     */
    async initialize(): Promise<void> {
        try {
            logger.info('Initializing ScheduleJobManager from database...');

            // Clear all existing jobs in Redis (fresh start)
            await this.clearAllRedisJobs();

            // Load active jobs from database
            const scheduledJobs = await this.prisma.scheduledJob.findMany({
                where: { active: true },
                include: {
                    workflow: {
                        select: {
                            id: true,
                            name: true,
                            userId: true,
                            triggers: true,
                            active: true,
                        },
                    },
                },
            });

            let jobCount = 0;

            for (const scheduledJob of scheduledJobs) {
                // Skip if workflow is not active
                if (!scheduledJob.workflow.active) {
                    logger.warn(`Skipping job ${scheduledJob.id} - workflow ${scheduledJob.workflowId} is inactive`);
                    continue;
                }

                // Find the trigger in workflow JSON
                const triggers = (scheduledJob.workflow.triggers as any[]) || [];
                const trigger = triggers.find((t) => t.id === scheduledJob.triggerId);

                if (!trigger) {
                    logger.warn(`Trigger ${scheduledJob.triggerId} not found in workflow ${scheduledJob.workflowId}`);
                    continue;
                }

                // Create Bull job
                await this.createBullJob(scheduledJob, trigger, scheduledJob.workflow);
                jobCount++;
            }

            logger.info(`ScheduleJobManager initialized with ${jobCount} scheduled jobs from database`);
        } catch (error) {
            logger.error('Error initializing ScheduleJobManager:', error);
            throw error;
        }
    }

    /**
     * Clear all jobs from Redis (used during initialization)
     */
    private async clearAllRedisJobs(): Promise<void> {
        try {
            const repeatableJobs = await this.scheduleQueue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                await this.scheduleQueue.removeRepeatableByKey(job.key);
            }
            logger.info(`Cleared ${repeatableJobs.length} jobs from Redis`);
        } catch (error) {
            logger.error('Error clearing Redis jobs:', error);
        }
    }

    /**
     * Create Bull job from database record
     */
    private async createBullJob(
        scheduledJob: any,
        trigger: any,
        workflow: any
    ): Promise<Job<ScheduleJobData>> {
        const job = await this.scheduleQueue.add(
            {
                workflowId: scheduledJob.workflowId,
                triggerId: scheduledJob.triggerId,
                triggerNodeId: trigger.nodeId,
                cronExpression: scheduledJob.cronExpression,
                timezone: scheduledJob.timezone,
                description: scheduledJob.description || 'Scheduled execution',
                userId: workflow.userId,
            },
            {
                jobId: scheduledJob.jobKey,
                repeat: {
                    cron: scheduledJob.cronExpression,
                    tz: scheduledJob.timezone,
                },
            }
        );

        logger.info(`Created Bull job: ${scheduledJob.jobKey} - ${scheduledJob.cronExpression}`);
        return job;
    }

    /**
     * Add a schedule job for a trigger (creates database record and Bull job)
     */
    async addScheduleJob(
        workflowId: string,
        workflowName: string,
        userId: string,
        trigger: any
    ): Promise<Job<ScheduleJobData>> {
        const cronExpression = trigger.settings?.cronExpression;
        const timezone = trigger.settings?.timezone || 'UTC';
        const description = trigger.settings?.description || 'Scheduled execution';

        if (!cronExpression) {
            throw new Error('Cron expression is required');
        }

        const jobKey = `${workflowId}-${trigger.id}`;

        // Create or update database record
        const scheduledJob = await this.prisma.scheduledJob.upsert({
            where: {
                workflowId_triggerId: {
                    workflowId,
                    triggerId: trigger.id,
                },
            },
            create: {
                workflowId,
                triggerId: trigger.id,
                jobKey,
                cronExpression,
                timezone,
                description,
                active: true,
            },
            update: {
                cronExpression,
                timezone,
                description,
                active: true,
                jobKey,
            },
            include: {
                workflow: {
                    select: {
                        id: true,
                        name: true,
                        userId: true,
                        triggers: true,
                    },
                },
            },
        });

        // Remove existing Bull job if it exists
        await this.removeBullJob(jobKey);

        // Create new Bull job
        const job = await this.createBullJob(scheduledJob, trigger, scheduledJob.workflow);

        logger.info(`Added schedule job: ${jobKey} (${description}) - ${cronExpression}`);

        return job;
    }

    /**
     * Remove Bull job from Redis
     */
    private async removeBullJob(jobKey: string): Promise<void> {
        try {
            const repeatableJobs = await this.scheduleQueue.getRepeatableJobs();
            const job = repeatableJobs.find((j) => j.id === jobKey || j.key.includes(jobKey));

            if (job) {
                await this.scheduleQueue.removeRepeatableByKey(job.key);
            }

            // Also remove any pending jobs
            const jobs = await this.scheduleQueue.getJobs(['waiting', 'delayed']);
            for (const j of jobs) {
                if (j.id === jobKey) {
                    await j.remove();
                }
            }
        } catch (error) {
            logger.error(`Error removing Bull job ${jobKey}:`, error);
        }
    }

    /**
     * Remove a schedule job (deletes from database and Redis)
     */
    async removeScheduleJob(jobId: string): Promise<void> {
        try {
            // Parse jobId to get workflowId and triggerId
            // jobId format: workflowId-triggerId (triggerId may contain dashes)
            const firstDashIndex = jobId.indexOf('-');
            if (firstDashIndex === -1) {
                throw new Error(`Invalid jobId format: ${jobId}`);
            }
            
            const workflowId = jobId.substring(0, firstDashIndex);
            const triggerId = jobId.substring(firstDashIndex + 1);

            logger.info(`Attempting to delete schedule job: ${jobId} (workflowId: ${workflowId}, triggerId: ${triggerId})`);

            // Check if job exists before deleting
            const existingJob = await this.prisma.scheduledJob.findFirst({
                where: {
                    workflowId,
                    triggerId,
                },
            });

            if (existingJob) {
                logger.info(`Found existing job in database: ${existingJob.id}`);
                
                // Delete from database
                const deleteResult = await this.prisma.scheduledJob.deleteMany({
                    where: {
                        workflowId,
                        triggerId,
                    },
                });

                logger.info(`Deleted ${deleteResult.count} job(s) from database`);
            } else {
                logger.warn(`No job found in database for ${jobId}`);
            }

            // Remove from Redis
            await this.removeBullJob(jobId);

            logger.info(`Successfully removed schedule job: ${jobId}`);
        } catch (error) {
            logger.error(`Error removing schedule job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Remove all schedule jobs for a workflow
     */
    async removeWorkflowJobs(workflowId: string): Promise<void> {
        try {
            // Get all jobs for this workflow from database
            const scheduledJobs = await this.prisma.scheduledJob.findMany({
                where: { workflowId },
            });

            // Delete from database
            await this.prisma.scheduledJob.deleteMany({
                where: { workflowId },
            });

            // Remove from Redis
            for (const job of scheduledJobs) {
                await this.removeBullJob(job.jobKey);
            }

            logger.info(`Removed ${scheduledJobs.length} schedule jobs for workflow ${workflowId}`);
        } catch (error) {
            logger.error(`Error removing workflow jobs for ${workflowId}:`, error);
            throw error;
        }
    }

    /**
     * Sync schedule jobs for a workflow (updates database and Redis)
     */
    async syncWorkflowJobs(workflowId: string): Promise<void> {
        try {
            // Get workflow
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
                select: {
                    id: true,
                    name: true,
                    userId: true,
                    active: true,
                    triggers: true,
                },
            });

            if (!workflow) {
                logger.warn(`Workflow ${workflowId} not found`);
                return;
            }

            // Get schedule triggers from workflow JSON
            const triggers = (workflow.triggers as any[]) || [];
            const scheduleTriggers = triggers.filter((t) => {
                const isActive = t.active !== undefined ? t.active : true;
                return t.type === 'schedule' && isActive;
            });

            // Get existing scheduled jobs from database
            const existingJobs = await this.prisma.scheduledJob.findMany({
                where: { workflowId },
            });

            const existingTriggerIds = new Set(existingJobs.map((j: any) => j.triggerId));
            const currentTriggerIds = new Set(scheduleTriggers.map((t: any) => t.id));

            // Remove jobs that no longer exist in workflow triggers
            for (const job of existingJobs) {
                if (!currentTriggerIds.has(job.triggerId)) {
                    await this.removeScheduleJob(job.jobKey);
                }
            }

            // Add or update jobs for current triggers
            if (workflow.active) {
                for (const trigger of scheduleTriggers) {
                    await this.addScheduleJob(workflow.id, workflow.name, workflow.userId, trigger);
                }
            } else {
                // If workflow is inactive, mark all jobs as inactive
                await this.prisma.scheduledJob.updateMany({
                    where: { workflowId },
                    data: { active: false },
                });

                // Remove from Redis
                for (const job of existingJobs) {
                    await this.removeBullJob(job.jobKey);
                }
            }

            logger.info(`Synced ${scheduleTriggers.length} schedule jobs for workflow ${workflowId}`);
        } catch (error) {
            logger.error(`Error syncing workflow jobs for ${workflowId}:`, error);
            throw error;
        }
    }

    /**
     * Get all schedule jobs from database
     */
    async getAllScheduleJobs(): Promise<ScheduleJobInfo[]> {
        try {
            const scheduledJobs = await this.prisma.scheduledJob.findMany({
                include: {
                    workflow: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            return scheduledJobs.map((job: any) => ({
                id: job.jobKey,
                workflowId: job.workflowId,
                workflowName: job.workflow.name,
                triggerId: job.triggerId,
                cronExpression: job.cronExpression,
                timezone: job.timezone,
                description: job.description || 'Scheduled execution',
                nextRun: job.nextRun,
                lastRun: job.lastRun,
                status: job.active ? 'active' : 'paused',
                failCount: job.failCount,
            }));
        } catch (error) {
            logger.error('Error getting schedule jobs:', error);
            return [];
        }
    }

    /**
     * Get schedule jobs for a workflow
     */
    async getWorkflowScheduleJobs(workflowId: string): Promise<ScheduleJobInfo[]> {
        try {
            const scheduledJobs = await this.prisma.scheduledJob.findMany({
                where: { workflowId },
                include: {
                    workflow: {
                        select: {
                            name: true,
                        },
                    },
                },
            });

            return scheduledJobs.map((job: any) => ({
                id: job.jobKey,
                workflowId: job.workflowId,
                workflowName: job.workflow.name,
                triggerId: job.triggerId,
                cronExpression: job.cronExpression,
                timezone: job.timezone,
                description: job.description || 'Scheduled execution',
                nextRun: job.nextRun,
                lastRun: job.lastRun,
                status: job.active ? 'active' : 'paused',
                failCount: job.failCount,
            }));
        } catch (error) {
            logger.error(`Error getting workflow schedule jobs for ${workflowId}:`, error);
            return [];
        }
    }

    /**
     * Pause a schedule job (updates database and removes from Redis)
     */
    async pauseScheduleJob(jobId: string): Promise<void> {
        try {
            // Parse jobId to get workflowId and triggerId
            const firstDashIndex = jobId.indexOf('-');
            if (firstDashIndex === -1) {
                throw new Error(`Invalid jobId format: ${jobId}`);
            }
            
            const workflowId = jobId.substring(0, firstDashIndex);
            const triggerId = jobId.substring(firstDashIndex + 1);

            // Update database
            await this.prisma.scheduledJob.updateMany({
                where: {
                    workflowId,
                    triggerId,
                },
                data: {
                    active: false,
                },
            });

            // Remove from Redis
            await this.removeBullJob(jobId);

            logger.info(`Paused schedule job: ${jobId}`);
        } catch (error) {
            logger.error(`Error pausing schedule job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Resume a schedule job (updates database and adds to Redis)
     */
    async resumeScheduleJob(workflowId: string, triggerId: string): Promise<void> {
        try {
            // Get workflow and trigger
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
                select: {
                    id: true,
                    name: true,
                    userId: true,
                    triggers: true,
                    active: true,
                },
            });

            if (!workflow) {
                throw new Error('Workflow not found');
            }

            if (!workflow.active) {
                throw new Error('Cannot resume job for inactive workflow');
            }

            const triggers = (workflow.triggers as any[]) || [];
            const trigger = triggers.find((t) => t.id === triggerId);

            if (!trigger) {
                throw new Error('Trigger not found');
            }

            // Update database
            await this.prisma.scheduledJob.updateMany({
                where: {
                    workflowId,
                    triggerId,
                },
                data: {
                    active: true,
                },
            });

            // Add to Redis
            await this.addScheduleJob(workflow.id, workflow.name, workflow.userId, trigger);

            logger.info(`Resumed schedule job: ${workflowId}-${triggerId}`);
        } catch (error) {
            logger.error(`Error resuming schedule job ${workflowId}-${triggerId}:`, error);
            throw error;
        }
    }

    /**
     * Update job execution stats (called after job execution)
     */
    private async updateJobStats(
        workflowId: string,
        triggerId: string,
        success: boolean,
        error?: any
    ): Promise<void> {
        try {
            const updateData: any = {
                lastRun: new Date(),
            };

            if (success) {
                updateData.failCount = 0;
                updateData.lastError = null;
            } else {
                updateData.failCount = { increment: 1 };
                updateData.lastError = error ? JSON.parse(JSON.stringify(error)) : null;
            }

            await this.prisma.scheduledJob.updateMany({
                where: {
                    workflowId,
                    triggerId,
                },
                data: updateData,
            });
        } catch (error) {
            logger.error('Error updating job stats:', error);
        }
    }

    /**
     * Setup queue processors
     */
    private setupQueueProcessors(): void {
        this.scheduleQueue.process(async (job: Job<ScheduleJobData>) => {
            const { workflowId, triggerId, triggerNodeId, userId, description } = job.data;

            logger.info(`Processing scheduled execution: ${workflowId} (${description})`);

            try {
                // Execute workflow
                const result = await this.executionService.executeWorkflow(
                    workflowId,
                    userId,
                    {
                        scheduledAt: new Date().toISOString(),
                        triggerId,
                        triggerType: 'schedule',
                    },
                    {},
                    triggerNodeId
                );

                const executionId = result.data?.executionId;
                logger.info(`Scheduled execution completed: ${executionId}`);

                // Update job stats
                await this.updateJobStats(workflowId, triggerId, true);

                return {
                    success: true,
                    executionId,
                };
            } catch (error) {
                logger.error(`Scheduled execution failed for ${workflowId}:`, error);

                // Update job stats
                await this.updateJobStats(workflowId, triggerId, false, error);

                throw error;
            }
        });
    }

    /**
     * Setup queue events
     */
    private setupQueueEvents(): void {
        this.scheduleQueue.on('completed', (job, result) => {
            logger.info(`Schedule job completed: ${job.id}`, result);
        });

        this.scheduleQueue.on('failed', (job, err) => {
            logger.error(`Schedule job failed: ${job?.id}`, err);
        });

        this.scheduleQueue.on('error', (error) => {
            logger.error('Schedule queue error:', error);
        });
    }

    /**
     * Shutdown - Clean up resources
     */
    async shutdown(): Promise<void> {
        try {
            await this.scheduleQueue.close();
            logger.info('ScheduleJobManager shut down');
        } catch (error) {
            logger.error('Error shutting down ScheduleJobManager:', error);
        }
    }
}
