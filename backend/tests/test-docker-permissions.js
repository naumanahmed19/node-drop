const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testDockerPermissions() {
  console.log('🐳 Docker Permissions Test\n');
  
  try {
    // Check current process info
    console.log('📊 Process Information:');
    console.log(`   Process UID: ${process.getuid ? process.getuid() : 'N/A'}`);
    console.log(`   Process GID: ${process.getgid ? process.getgid() : 'N/A'}`);
    console.log(`   Process PID: ${process.pid}`);
    console.log(`   Working Directory: ${process.cwd()}`);
    
    // Check if we're in Docker
    const isDocker = fs.existsSync('/.dockerenv') || fs.existsSync('/proc/1/cgroup');
    console.log(`   Running in Docker: ${isDocker ? 'Yes' : 'No'}`);
    
    // Check custom-nodes directory
    const customNodesPath = path.join(__dirname, 'custom-nodes');
    console.log(`\n📁 Custom Nodes Directory: ${customNodesPath}`);
    
    if (!fs.existsSync(customNodesPath)) {
      console.log('   ❌ Directory does not exist');
      return;
    }
    
    // Check directory permissions
    try {
      const stats = await fs.promises.stat(customNodesPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      
      console.log(`   📋 Directory Stats:`);
      console.log(`      Permissions: ${permissions} (${getPermissionString(stats.mode)})`);
      console.log(`      Owner UID: ${stats.uid}`);
      console.log(`      Owner GID: ${stats.gid}`);
      console.log(`      Size: ${stats.size} bytes`);
      console.log(`      Modified: ${stats.mtime}`);
      
      // Check if we can write to the directory
      const canWrite = await testWritePermission(customNodesPath);
      console.log(`      Can Write: ${canWrite ? '✅ Yes' : '❌ No'}`);
      
    } catch (error) {
      console.log(`   ❌ Cannot stat directory: ${error.message}`);
    }
    
    // Check each package
    console.log(`\n📦 Package Permissions:`);
    
    try {
      const packages = await fs.promises.readdir(customNodesPath, { withFileTypes: true });
      const dirs = packages.filter(p => p.isDirectory());
      
      for (const dir of dirs) {
        const packagePath = path.join(customNodesPath, dir.name);
        
        try {
          const stats = await fs.promises.stat(packagePath);
          const permissions = (stats.mode & parseInt('777', 8)).toString(8);
          
          console.log(`\n   📁 ${dir.name}:`);
          console.log(`      Permissions: ${permissions} (${getPermissionString(stats.mode)})`);
          console.log(`      Owner UID: ${stats.uid}`);
          console.log(`      Owner GID: ${stats.gid}`);
          
          // Test if we can delete this package
          const canDelete = await testDeletePermission(packagePath);
          console.log(`      Can Delete: ${canDelete ? '✅ Yes' : '❌ No'}`);
          
          // Check some files inside
          try {
            const files = await fs.promises.readdir(packagePath);
            const sampleFiles = files.slice(0, 3);
            
            console.log(`      Sample Files:`);
            for (const file of sampleFiles) {
              const filePath = path.join(packagePath, file);
              try {
                const fileStats = await fs.promises.stat(filePath);
                const filePerms = (fileStats.mode & parseInt('777', 8)).toString(8);
                const isDir = fileStats.isDirectory() ? 'd' : 'f';
                console.log(`        ${isDir} ${file}: ${filePerms} (uid:${fileStats.uid}, gid:${fileStats.gid})`);
              } catch (error) {
                console.log(`        ? ${file}: Cannot stat (${error.message})`);
              }
            }
            
            if (files.length > 3) {
              console.log(`        ... and ${files.length - 3} more files`);
            }
            
          } catch (error) {
            console.log(`      ❌ Cannot list files: ${error.message}`);
          }
          
        } catch (error) {
          console.log(`   ❌ ${dir.name}: Cannot stat (${error.message})`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Cannot list packages: ${error.message}`);
    }
    
    // Docker-specific checks
    if (isDocker) {
      console.log(`\n🐳 Docker-Specific Information:`);
      
      try {
        // Try to get user info
        const whoami = execSync('whoami', { encoding: 'utf8' }).trim();
        console.log(`   Current User: ${whoami}`);
      } catch (error) {
        console.log(`   Current User: Cannot determine (${error.message})`);
      }
      
      try {
        // Try to get group info
        const groups = execSync('groups', { encoding: 'utf8' }).trim();
        console.log(`   Groups: ${groups}`);
      } catch (error) {
        console.log(`   Groups: Cannot determine (${error.message})`);
      }
      
      try {
        // Check if running as root
        const id = execSync('id', { encoding: 'utf8' }).trim();
        console.log(`   ID Info: ${id}`);
      } catch (error) {
        console.log(`   ID Info: Cannot determine (${error.message})`);
      }
    }
    
    // Recommendations
    console.log(`\n💡 Recommendations:`);
    
    if (isDocker) {
      console.log(`   🐳 For Docker containers:`);
      console.log(`      1. Ensure the container runs with proper user permissions`);
      console.log(`      2. Consider using --user flag: docker run --user $(id -u):$(id -g)`);
      console.log(`      3. Or fix permissions: docker exec -it container chown -R node:node /app/custom-nodes`);
      console.log(`      4. Or run as root temporarily: docker exec -it --user root container bash`);
    }
    
    console.log(`   📁 For file permissions:`);
    console.log(`      1. Ensure the process user owns the custom-nodes directory`);
    console.log(`      2. Set proper permissions: chmod -R 755 custom-nodes/`);
    console.log(`      3. Check parent directory permissions as well`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function getPermissionString(mode) {
  const permissions = [];
  
  // Owner permissions
  permissions.push((mode & 0o400) ? 'r' : '-');
  permissions.push((mode & 0o200) ? 'w' : '-');
  permissions.push((mode & 0o100) ? 'x' : '-');
  
  // Group permissions
  permissions.push((mode & 0o040) ? 'r' : '-');
  permissions.push((mode & 0o020) ? 'w' : '-');
  permissions.push((mode & 0o010) ? 'x' : '-');
  
  // Other permissions
  permissions.push((mode & 0o004) ? 'r' : '-');
  permissions.push((mode & 0o002) ? 'w' : '-');
  permissions.push((mode & 0o001) ? 'x' : '-');
  
  return permissions.join('');
}

async function testWritePermission(dirPath) {
  try {
    const testFile = path.join(dirPath, '.write-test-' + Date.now());
    await fs.promises.writeFile(testFile, 'test');
    await fs.promises.unlink(testFile);
    return true;
  } catch (error) {
    return false;
  }
}

async function testDeletePermission(dirPath) {
  try {
    // Create a test directory
    const testDir = path.join(dirPath, '.delete-test-' + Date.now());
    await fs.promises.mkdir(testDir);
    
    // Try to delete it
    await fs.promises.rmdir(testDir);
    return true;
  } catch (error) {
    // Clean up if creation succeeded but deletion failed
    try {
      const testDir = path.join(dirPath, '.delete-test-' + Date.now());
      await fs.promises.rmdir(testDir);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    return false;
  }
}

testDockerPermissions().catch(console.error);