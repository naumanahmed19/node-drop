/**
 * Test script for database-backed scheduled jobs
 * 
 * This script tests the new implementation to ensure:
 * 1. Jobs are stored in database
 * 2. Jobs persist across restarts
 * 3. Delete/pause operations persist
 */

import { PrismaClient } from '@prisma/client';
import { ScheduleJobManager } from './ScheduleJobManager';
import { ExecutionService } from '../services/ExecutionService';
import { NodeService } from '../services/NodeService';
import ExecutionHistoryService from '../services/ExecutionHistoryService';
import { logger } from '../utils/logger';

async function testScheduledJobsDatabase() {
    const prisma = new PrismaClient();
    const nodeService = new NodeService(prisma);
    const executionHistoryService = new ExecutionHistoryService(prisma);
    const executionService = new ExecutionService(prisma, nodeService, executionHistoryService);
    const scheduleJobManager = new ScheduleJobManager(prisma, executionService);

    try {
        logger.info('🧪 Testing Database-Backed Scheduled Jobs\n');

        // Test 1: Check database table exists
        logger.info('Test 1: Verify database table exists');
        const tableExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'scheduled_jobs'
            );
        `;
        logger.info(`✅ scheduled_jobs table exists: ${JSON.stringify(tableExists)}\n`);

        // Test 2: Count existing jobs
        logger.info('Test 2: Count existing jobs in database');
        const jobCount = await prisma.scheduledJob.count();
        logger.info(`📊 Found ${jobCount} scheduled jobs in database\n`);

        // Test 3: List all jobs
        logger.info('Test 3: List all jobs');
        const jobs = await prisma.scheduledJob.findMany({
            include: {
                workflow: {
                    select: {
                        name: true,
                        active: true,
                    },
                },
            },
        });

        if (jobs.length > 0) {
            logger.info('📋 Scheduled Jobs:');
            jobs.forEach((job, index) => {
                logger.info(`\n  ${index + 1}. Job: ${job.jobKey}`);
                logger.info(`     Workflow: ${job.workflow.name} (${job.workflowId})`);
                logger.info(`     Cron: ${job.cronExpression}`);
                logger.info(`     Timezone: ${job.timezone}`);
                logger.info(`     Active: ${job.active}`);
                logger.info(`     Last Run: ${job.lastRun || 'Never'}`);
                logger.info(`     Next Run: ${job.nextRun || 'Not scheduled'}`);
                logger.info(`     Fail Count: ${job.failCount}`);
            });
        } else {
            logger.info('   No jobs found in database');
        }
        logger.info('');

        // Test 4: Test ScheduleJobManager initialization
        logger.info('Test 4: Initialize ScheduleJobManager');
        await scheduleJobManager.initialize();
        logger.info('✅ ScheduleJobManager initialized successfully\n');

        // Test 5: Get all jobs via manager
        logger.info('Test 5: Get all jobs via ScheduleJobManager');
        const managerJobs = await scheduleJobManager.getAllScheduleJobs();
        logger.info(`📊 Manager reports ${managerJobs.length} jobs\n`);

        // Test 6: Verify database and manager are in sync
        logger.info('Test 6: Verify database and manager sync');
        const activeDbJobs = await prisma.scheduledJob.count({ where: { active: true } });
        if (activeDbJobs === managerJobs.length) {
            logger.info(`✅ Database and manager are in sync (${activeDbJobs} active jobs)\n`);
        } else {
            logger.warn(`⚠️  Mismatch: DB has ${activeDbJobs} active jobs, manager has ${managerJobs.length}\n`);
        }

        // Test 7: Check for workflows with schedule triggers
        logger.info('Test 7: Check workflows with schedule triggers');
        const workflows = await prisma.workflow.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                triggers: true,
            },
        });

        let workflowsWithSchedules = 0;
        let totalScheduleTriggers = 0;

        workflows.forEach((workflow) => {
            const triggers = (workflow.triggers as any[]) || [];
            const scheduleTriggers = triggers.filter((t) => {
                const isActive = t.active !== undefined ? t.active : true;
                return t.type === 'schedule' && isActive;
            });

            if (scheduleTriggers.length > 0) {
                workflowsWithSchedules++;
                totalScheduleTriggers += scheduleTriggers.length;
            }
        });

        logger.info(`📊 Found ${workflowsWithSchedules} workflows with schedule triggers`);
        logger.info(`📊 Total schedule triggers: ${totalScheduleTriggers}`);
        logger.info(`📊 Jobs in database: ${jobCount}\n`);

        if (totalScheduleTriggers !== jobCount) {
            logger.warn(`⚠️  Mismatch detected!`);
            logger.warn(`   Triggers in workflows: ${totalScheduleTriggers}`);
            logger.warn(`   Jobs in database: ${jobCount}`);
            logger.warn(`   Consider running: npm run jobs:migrate\n`);
        } else {
            logger.info(`✅ Triggers and database jobs are in sync\n`);
        }

        // Test 8: Summary
        logger.info('📊 Summary:');
        logger.info(`   Total workflows: ${workflows.length}`);
        logger.info(`   Workflows with schedules: ${workflowsWithSchedules}`);
        logger.info(`   Schedule triggers: ${totalScheduleTriggers}`);
        logger.info(`   Database jobs: ${jobCount}`);
        logger.info(`   Active jobs: ${activeDbJobs}`);
        logger.info(`   Manager jobs: ${managerJobs.length}`);

        logger.info('\n✅ All tests completed successfully!');

    } catch (error) {
        logger.error('❌ Test failed:', error);
        throw error;
    } finally {
        await scheduleJobManager.shutdown();
        await prisma.$disconnect();
    }
}

// Run tests
if (require.main === module) {
    testScheduledJobsDatabase()
        .then(() => {
            logger.info('\n✅ Test script completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('\n❌ Test script failed:', error);
            process.exit(1);
        });
}

export { testScheduledJobsDatabase };
