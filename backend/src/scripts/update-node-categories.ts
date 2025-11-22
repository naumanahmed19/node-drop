import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateNodeCategories() {
  console.log('🔄 Updating node categories in database...\n');

  const updates = [
    // Model nodes
    { identifier: 'openai-model', nodeCategory: 'service' },
    { identifier: 'anthropic-model', nodeCategory: 'service' },
    
    // Memory nodes
    { identifier: 'buffer-memory', nodeCategory: 'service' },
    { identifier: 'window-memory', nodeCategory: 'service' },
    { identifier: 'redis-memory', nodeCategory: 'service' },
    
    // Tool nodes
    { identifier: 'calculator-tool', nodeCategory: 'tool' },
    { identifier: 'http-request-tool', nodeCategory: 'tool' },
    { identifier: 'knowledge-base-tool', nodeCategory: 'tool' },
    { identifier: 'slack-tool', nodeCategory: 'tool' },
  ];

  let updated = 0;
  let notFound = 0;

  for (const update of updates) {
    const result = await prisma.nodeType.updateMany({
      where: { identifier: update.identifier },
      data: { nodeCategory: update.nodeCategory },
    });

    if (result.count > 0) {
      console.log(`✅ Updated ${update.identifier} -> nodeCategory: ${update.nodeCategory}`);
      updated++;
    } else {
      console.log(`⚠️  Node not found in database: ${update.identifier}`);
      notFound++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Total: ${updates.length}`);

  await prisma.$disconnect();
  console.log('\n✅ Database update complete!');
}

updateNodeCategories().catch((error) => {
  console.error('❌ Error updating node categories:', error);
  process.exit(1);
});
