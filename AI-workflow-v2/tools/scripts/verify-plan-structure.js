/**
 * Plan Structure Verification Script
 *
 * This script checks if a plan has all required directories and files
 * according to the Plan Storage Framework (Rule 500).
 *
 * Usage: node verify-plan-structure.js <plan-directory-name>
 * Example: node verify-plan-structure.js plan-user-auth-2025-04-18
 */

const fs = require("fs");
const path = require("path");

// Configuration
const WORKSPACE_DIR = "../../ai-workflow-workspace";
const PLANS_DIR = path.join(WORKSPACE_DIR, "plans");
const REGISTRY_DIR = path.join(WORKSPACE_DIR, "registry");

// Required plan structure
const REQUIRED_STRUCTURE = {
  // Root level files
  files: ["README.md"],

  // Required directories with their required files
  directories: {
    implementation: {
      files: ["plan.md", "status.md"],
    },
    artifacts: {
      directories: {
        diagrams: { files: [] },
        code: { files: [] },
        documentation: { files: [] },
      },
    },
    evaluation: {
      files: ["test-plan.md"],
    },
    references: {
      files: ["lessons-learned.md"],
    },
  },
};

// Registry files that should reference the plan
const REGISTRY_FILES = ["plan-registry.md", "implementation-log.md"];

/**
 * Check if a plan directory exists and has the required structure
 */
function verifyPlanStructure(planName) {
  console.log(`\n🔍 Verifying plan structure for: ${planName}`);

  // 1. Check if plan directory exists in the correct location
  const planDir = path.join(PLANS_DIR, planName);
  if (!fs.existsSync(planDir)) {
    console.error(`❌ ERROR: Plan directory not found at: ${planDir}`);
    console.error(`   Plans must be created in: ${PLANS_DIR}`);
    return false;
  }

  console.log(`✅ Plan directory exists at correct location`);

  // 2. Recursively check directory structure
  let success = checkDirectoryStructure(planDir, REQUIRED_STRUCTURE);

  // 3. Check registry files
  console.log(`\n🔍 Checking registry references:`);
  REGISTRY_FILES.forEach((registryFile) => {
    const registryPath = path.join(REGISTRY_DIR, registryFile);
    if (!fs.existsSync(registryPath)) {
      console.error(`❌ Registry file not found: ${registryPath}`);
      success = false;
      return;
    }

    const registryContent = fs.readFileSync(registryPath, "utf8");
    if (registryContent.includes(planName)) {
      console.log(`✅ Plan is referenced in ${registryFile}`);
    } else {
      console.error(`❌ Plan is NOT referenced in ${registryFile}`);
      success = false;
    }
  });

  // 4. Display final result
  console.log("\n===== VERIFICATION RESULT =====");
  if (success) {
    console.log("✅ PASSED: Plan structure meets all requirements");
  } else {
    console.log("❌ FAILED: Plan structure does not meet requirements");
    console.log(
      "\nRefer to AI-workflow-v2/tools/checklists/implementation-checklist.md for details",
    );
  }

  return success;
}

/**
 * Recursively check a directory against the required structure
 */
function checkDirectoryStructure(dirPath, structure, indent = "") {
  let success = true;

  // Check required files
  if (structure.files) {
    console.log(
      `${indent}🔍 Checking required files in: ${path.basename(dirPath)}/`,
    );
    structure.files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.existsSync(filePath)) {
        console.log(`${indent}  ✅ ${file}`);
      } else {
        console.error(`${indent}  ❌ ${file} (MISSING)`);
        success = false;
      }
    });
  }

  // Check required directories
  if (structure.directories) {
    Object.entries(structure.directories).forEach(([dir, subStructure]) => {
      const subDirPath = path.join(dirPath, dir);
      if (!fs.existsSync(subDirPath)) {
        console.error(`${indent}❌ Directory missing: ${dir}/`);
        success = false;
        return;
      }

      console.log(`${indent}✅ ${dir}/`);
      const subDirSuccess = checkDirectoryStructure(
        subDirPath,
        subStructure,
        `${indent}  `,
      );
      if (!subDirSuccess) success = false;
    });
  }

  return success;
}

// Get plan name from command line arguments
const planName = process.argv[2];
if (!planName) {
  console.error("Error: Please provide a plan directory name");
  console.error("Usage: node verify-plan-structure.js <plan-directory-name>");
  console.error(
    "Example: node verify-plan-structure.js plan-user-auth-2025-04-18",
  );
  process.exit(1);
}

// Run verification
verifyPlanStructure(planName);
