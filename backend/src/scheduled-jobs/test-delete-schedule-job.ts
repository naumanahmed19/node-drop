/**
 * Test script for scheduled job deletion
 * 
 * This script tests the delete functionality to ensure jobs are properly
 * removed from both the database and Redis.
 */

import { PrismaClient } from '@prisma/client';
import { ScheduleJobManager } from './ScheduleJobManager';
import { ExecutionService } from '../services/ExecutionService';
import { logger } from '../utils/logger';

async function testDeleteScheduleJob() {
    const prisma = new PrismaClient();
    const executionService = new ExecutionService(prisma);
    const scheduleJobManager = new ScheduleJobManager(prisma, executionService);

    try {
        logger.info('🧪 Testing Scheduled Job Deletion\n');

        // Step 1: List all jobs in database
        logger.info('Step 1: Checking jobs in database...');
        const allJobs = await prisma.scheduledJob.findMany({
            include: {
                workflow: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        logger.info(`Found ${allJobs.length} jobs in database:\n`);
        allJobs.forEach((job, index) => {
            logger.info(`  ${index + 1}. Job Key: ${job.jobKey}`);
            logger.info(`     Workflow: ${job.workflow.name}`);
            logger.info(`     Workflow ID: ${job.workflowId}`);
            logger.info(`     Trigger ID: ${job.triggerId}`);
            logger.info(`     Active: ${job.active}`);
            logger.info(`     Created: ${job.createdAt}`);
            logger.info('');
        });

        if (allJobs.length === 0) {
            logger.warn('⚠️  No jobs found in database. Cannot test deletion.');
            logger.info('\nTo test deletion:');
            logger.info('1. Create a workflow with a schedule trigger');
            logger.info('2. Activate the workflow');
            logger.info('3. Run this script again');
            return;
        }

        // Step 2: Select first job for testing
        const testJob = allJobs[0];
        const jobId = testJob.jobKey;
        logger.info(`Step 2: Testing deletion of job: ${jobId}`);
        logger.info(`        Workflow: ${testJob.workflow.name}`);
        logger.info(`        Workflow ID: ${testJob.workflowId}`);
        logger.info(`        Trigger ID: ${testJob.triggerId}\n`);

        // Step 3: Verify job exists before deletion
        logger.info('Step 3: Verifying job exists before deletion...');
        const jobBeforeDelete = await prisma.scheduledJob.findFirst({
            where: {
                workflowId: testJob.workflowId,
                triggerId: testJob.triggerId,
            },
        });

        if (jobBeforeDelete) {
            logger.info(`✅ Job exists in database (ID: ${jobBeforeDelete.id})\n`);
        } else {
            logger.error('❌ Job not found in database before deletion!');
            return;
        }

        // Step 4: Delete the job
        logger.info('Step 4: Deleting job...');
        try {
            await scheduleJobManager.removeScheduleJob(jobId);
            logger.info('✅ Delete operation completed\n');
        } catch (error) {
            logger.error('❌ Delete operation failed:', error);
            throw error;
        }

        // Step 5: Verify job is deleted
        logger.info('Step 5: Verifying job is deleted...');
        const jobAfterDelete = await prisma.scheduledJob.findFirst({
            where: {
                workflowId: testJob.workflowId,
                triggerId: testJob.triggerId,
            },
        });

        if (jobAfterDelete) {
            logger.error('❌ FAILED: Job still exists in database after deletion!');
            logger.error(`   Job ID: ${jobAfterDelete.id}`);
            logger.error(`   Job Key: ${jobAfterDelete.jobKey}`);
            logger.error(`   Active: ${jobAfterDelete.active}`);
            logger.error('\n🔍 Debugging Info:');
            logger.error(`   - Delete was called for: ${jobId}`);
            logger.error(`   - Workflow ID: ${testJob.workflowId}`);
            logger.error(`   - Trigger ID: ${testJob.triggerId}`);
            logger.error(`   - Job still in DB: ${jobAfterDelete.id}`);
        } else {
            logger.info('✅ SUCCESS: Job successfully deleted from database!\n');
        }

        // Step 6: Check remaining jobs
        logger.info('Step 6: Checking remaining jobs...');
        const remainingJobs = await prisma.scheduledJob.findMany();
        logger.info(`Remaining jobs in database: ${remainingJobs.length}\n`);

        if (remainingJobs.length > 0) {
            logger.info('Remaining jobs:');
            remainingJobs.forEach((job, index) => {
                logger.info(`  ${index + 1}. ${job.jobKey} (${job.workflowId})`);
            });
        }

        // Step 7: Summary
        logger.info('\n📊 Test Summary:');
        logger.info(`   Initial jobs: ${allJobs.length}`);
        logger.info(`   Deleted: 1`);
        logger.info(`   Remaining: ${remainingJobs.length}`);
        logger.info(`   Expected remaining: ${allJobs.length - 1}`);
        
        if (remainingJobs.length === allJobs.length - 1) {
            logger.info('\n✅ TEST PASSED: Delete functionality is working correctly!');
        } else {
            logger.error('\n❌ TEST FAILED: Delete functionality is not working!');
            logger.error(`   Expected ${allJobs.length - 1} jobs, but found ${remainingJobs.length}`);
        }

    } catch (error) {
        logger.error('❌ Test failed with error:', error);
        throw error;
    } finally {
        await scheduleJobManager.shutdown();
        await prisma.$disconnect();
    }
}

// Run test
if (require.main === module) {
    testDeleteScheduleJob()
        .then(() => {
            logger.info('\n✅ Test script completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('\n❌ Test script failed:', error);
            process.exit(1);
        });
}

export { testDeleteScheduleJob };
