const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testDockerUninstall() {
  console.log('🐳 Testing Uninstall in Docker Container\n');
  
  const baseURL = 'http://localhost:4000/api';
  
  try {
    // Step 1: Check what packages exist
    console.log('📋 Checking available packages...');
    const customNodesPath = '/app/custom-nodes';
    
    if (!fs.existsSync(customNodesPath)) {
      console.log('❌ custom-nodes directory not found');
      return;
    }
    
    const packages = fs.readdirSync(customNodesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`📦 Available packages: ${packages.join(', ')}`);
    
    if (packages.length === 0) {
      console.log('❌ No packages found to test');
      return;
    }
    
    // Test with MySQL if available, otherwise use first package
    let testPackage = packages.find(pkg => pkg.toLowerCase() === 'mysql');
    if (!testPackage) {
      testPackage = packages[0];
    }
    
    console.log(`\n🎯 Testing uninstall with package: ${testPackage}`);
    
    // Step 2: Check permissions
    console.log('\n🔍 Checking permissions...');
    const packagePath = path.join(customNodesPath, testPackage);
    
    try {
      const stats = fs.statSync(packagePath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      
      console.log(`   📁 Package: ${testPackage}`);
      console.log(`   📋 Permissions: ${permissions}`);
      console.log(`   👤 Owner UID: ${stats.uid}`);
      console.log(`   👥 Owner GID: ${stats.gid}`);
      console.log(`   🔧 Process UID: ${process.getuid ? process.getuid() : 'N/A'}`);
      console.log(`   🔧 Process GID: ${process.getgid ? process.getgid() : 'N/A'}`);
      
      // Test write permission
      try {
        const testFile = path.join(packagePath, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`   ✅ Can write to package directory`);
      } catch (error) {
        console.log(`   ❌ Cannot write to package directory: ${error.message}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Cannot check permissions: ${error.message}`);
    }
    
    // Step 3: Test API connection
    console.log('\n📡 Testing API connection...');
    try {
      const response = await axios.get(`${baseURL}/node-types`);
      console.log(`   ✅ API is accessible (${response.data.data?.length || 0} node types)`);
    } catch (error) {
      console.log(`   ❌ Cannot connect to API: ${error.message}`);
      return;
    }
    
    // Step 4: Perform uninstall
    console.log(`\n🗑️  Performing uninstall...`);
    console.log(`📡 DELETE ${baseURL}/node-types/packages/${testPackage}`);
    
    try {
      const response = await axios.delete(`${baseURL}/node-types/packages/${testPackage}`);
      
      console.log('\n📋 API Response:');
      console.log(JSON.stringify(response.data, null, 2));
      
      if (response.data.success) {
        console.log('\n✅ Uninstall API call successful!');
        
        // Check if files were removed
        const packageExistsAfter = fs.existsSync(packagePath);
        console.log(`\n📁 Package directory exists after uninstall: ${packageExistsAfter}`);
        
        if (!packageExistsAfter) {
          console.log('🎉 SUCCESS: Package directory was completely removed!');
        } else {
          console.log('❌ FAILED: Package directory still exists');
          
          // List remaining files
          try {
            const remainingFiles = fs.readdirSync(packagePath, { recursive: true });
            console.log(`📄 Remaining files (${remainingFiles.length}):`);
            remainingFiles.slice(0, 10).forEach(file => console.log(`   - ${file}`));
            if (remainingFiles.length > 10) {
              console.log(`   ... and ${remainingFiles.length - 10} more`);
            }
          } catch (error) {
            console.log(`Cannot list remaining files: ${error.message}`);
          }
        }
        
      } else {
        console.log('❌ Uninstall failed:', response.data);
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ Uninstall API error (${error.response.status}):`);
        console.log(JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('❌ Uninstall error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDockerUninstall().catch(console.error);