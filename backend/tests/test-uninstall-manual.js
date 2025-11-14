const fs = require('fs');
const path = require('path');

async function manualUninstallTest() {
  console.log('🔧 Manual Uninstall Test (No Server Required)\n');
  
  const customNodesPath = path.join(__dirname, 'custom-nodes');
  
  // Check what packages exist
  console.log('📋 Checking available packages...');
  
  if (!fs.existsSync(customNodesPath)) {
    console.log('❌ custom-nodes directory not found');
    return;
  }
  
  const packages = fs.readdirSync(customNodesPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`📦 Found packages: ${packages.join(', ')}`);
  
  if (packages.length === 0) {
    console.log('❌ No packages found');
    return;
  }
  
  // Show details for each package
  console.log('\n📊 Package Details:');
  for (const pkg of packages) {
    const pkgPath = path.join(customNodesPath, pkg);
    
    try {
      const files = fs.readdirSync(pkgPath, { recursive: true });
      const nodeFiles = files.filter(f => f.endsWith('.node.js') || f.endsWith('.node.ts'));
      const hasPackageJson = files.includes('package.json');
      
      console.log(`\n📦 ${pkg}:`);
      console.log(`   📁 Total files: ${files.length}`);
      console.log(`   🔧 Node files: ${nodeFiles.length} (${nodeFiles.join(', ')})`);
      console.log(`   📄 Has package.json: ${hasPackageJson}`);
      
      if (hasPackageJson) {
        try {
          const packageJsonPath = path.join(pkgPath, 'package.json');
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          console.log(`   📋 Package name: ${packageJson.name || 'N/A'}`);
          console.log(`   📋 Version: ${packageJson.version || 'N/A'}`);
          console.log(`   📋 Description: ${packageJson.description || 'N/A'}`);
          
          if (packageJson.nodeDrop && packageJson.nodeDrop.nodes) {
            console.log(`   🔧 Declared nodes: ${packageJson.nodeDrop.nodes.join(', ')}`);
          }
        } catch (error) {
          console.log(`   ⚠️  Could not read package.json: ${error.message}`);
        }
      }
      
      // Show directory structure
      console.log(`   📂 Structure:`);
      const dirs = files.filter(f => {
        const fullPath = path.join(pkgPath, f);
        return fs.statSync(fullPath).isDirectory();
      }).slice(0, 5);
      
      dirs.forEach(dir => console.log(`     📁 ${dir}/`));
      
      const topFiles = files.filter(f => {
        const fullPath = path.join(pkgPath, f);
        return fs.statSync(fullPath).isFile();
      }).slice(0, 5);
      
      topFiles.forEach(file => console.log(`     📄 ${file}`));
      
      if (files.length > 10) {
        console.log(`     ... and ${files.length - 10} more items`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error reading package: ${error.message}`);
    }
  }
  
  console.log('\n🔧 Manual Testing Instructions:');
  console.log('1. Start your backend server: npm run dev');
  console.log('2. Test the uninstall API with curl or the test script:');
  console.log('');
  
  packages.forEach(pkg => {
    console.log(`   # Uninstall ${pkg}:`);
    console.log(`   curl -X DELETE http://localhost:3001/api/node-types/packages/${pkg}`);
    console.log('');
  });
  
  console.log('3. Or use the automated test script:');
  console.log('   node test-mysql-uninstall.js');
  console.log('');
  console.log('4. Expected behavior:');
  console.log('   ✅ API returns success response');
  console.log('   ✅ Package directory is completely removed');
  console.log('   ✅ Database entries are cleaned up');
  console.log('   ✅ Nodes no longer appear in UI');
}

manualUninstallTest().catch(console.error);