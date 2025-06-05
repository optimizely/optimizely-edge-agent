#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PlanManager {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.plansDir = path.join(this.rootDir, 'plans');
    this.currentDir = path.join(this.rootDir, 'current');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.plansDir, this.currentDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // File operations
  readJSON(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      return null;
    }
  }

  writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Active plan management
  getActivePlan() {
    const activePlanPath = path.join(this.currentDir, 'active-plan.json');
    return this.readJSON(activePlanPath);
  }

  setActivePlan(planId) {
    const planPath = path.join(this.plansDir, `${planId}.json`);
    if (!fs.existsSync(planPath)) {
      return { error: `Plan ${planId} not found` };
    }

    const activePlan = {
      currentPlan: planId,
      currentTask: null,
      currentAction: null,
      lastUpdated: new Date().toISOString(),
      blockers: [],
      context: {}
    };

    this.writeJSON(path.join(this.currentDir, 'active-plan.json'), activePlan);
    return { success: true, planId };
  }

  // Plan operations
  createPlan(planData) {
    const plan = {
      id: planData.id,
      name: planData.name,
      description: planData.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        author: planData.author || 'Unknown',
        version: planData.version || '1.0.0',
        tags: planData.tags || [],
        priority: planData.priority || 'MEDIUM'
      },
      config: planData.config || {},
      tasks: planData.tasks || [],
      globalPatterns: planData.globalPatterns || {}
    };

    const planPath = path.join(this.plansDir, `${plan.id}.json`);
    this.writeJSON(planPath, plan);
    return { success: true, planId: plan.id };
  }

  getPlan(planId) {
    const planPath = path.join(this.plansDir, `${planId}.json`);
    const plan = this.readJSON(planPath);
    if (!plan) {
      return { error: `Plan ${planId} not found` };
    }
    return plan;
  }

  listPlans() {
    const plans = [];
    const files = fs.readdirSync(this.plansDir);
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const plan = this.readJSON(path.join(this.plansDir, file));
        if (plan) {
          const summary = {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            taskCount: plan.tasks.length,
            completed: plan.tasks.filter(t => t.status === 'DONE').length,
            createdAt: plan.createdAt
          };
          plans.push(summary);
        }
      }
    });

    return plans;
  }

  // Task operations
  getNextTask(planId) {
    const plan = this.getPlan(planId);
    if (plan.error) return plan;

    // Find first task that is PENDING and has no unmet dependencies
    const completedTasks = plan.tasks.filter(t => t.status === 'DONE').map(t => t.id);
    
    for (const task of plan.tasks) {
      if (task.status === 'PENDING') {
        const dependencies = task.dependencies || [];
        const unmetDeps = dependencies.filter(dep => !completedTasks.includes(dep));
        
        if (unmetDeps.length === 0) {
          return task;
        }
      }
    }

    return { message: 'No available tasks. Check for blocked or completed tasks.' };
  }

  updateTaskStatus(planId, taskId, status, notes) {
    const plan = this.getPlan(planId);
    if (plan.error) return plan;

    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) {
      return { error: `Task ${taskId} not found` };
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();

    if (status === 'IN_PROGRESS' && !task.startedAt) {
      task.startedAt = new Date().toISOString();
    }

    if (status === 'DONE') {
      task.completedAt = new Date().toISOString();
      if (task.startedAt) {
        const duration = Date.now() - new Date(task.startedAt).getTime();
        task.actualTime = `${Math.round(duration / 1000 / 60)}m`;
      }
    }

    if (notes) {
      task.implementationNotes = task.implementationNotes || [];
      task.implementationNotes.push({
        timestamp: new Date().toISOString(),
        note: notes,
        type: status === 'BLOCKED' ? 'error' : 'info'
      });
    }

    // Update active plan context
    const activePlan = this.getActivePlan();
    if (activePlan && activePlan.currentPlan === planId) {
      if (status === 'IN_PROGRESS') {
        activePlan.currentTask = taskId;
        activePlan.currentAction = 0;
      } else if (status === 'DONE' || status === 'BLOCKED') {
        activePlan.currentTask = null;
        activePlan.currentAction = null;
      }
      activePlan.lastUpdated = new Date().toISOString();
      this.writeJSON(path.join(this.currentDir, 'active-plan.json'), activePlan);
    }

    plan.updatedAt = new Date().toISOString();
    this.writeJSON(path.join(this.plansDir, `${planId}.json`), plan);

    return { success: true, taskId, status };
  }

  // Atomic action operations
  updateActionStatus(planId, taskId, actionId, completed, notes) {
    const plan = this.getPlan(planId);
    if (plan.error) return plan;

    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) {
      return { error: `Task ${taskId} not found` };
    }

    const action = task.atomicActions.find(a => a.id === actionId);
    if (!action) {
      return { error: `Action ${actionId} not found` };
    }

    action.completed = completed;
    if (completed) {
      action.completedAt = new Date().toISOString();
    }
    if (notes) {
      action.notes = notes;
    }

    // Update active plan context
    const activePlan = this.getActivePlan();
    if (activePlan && activePlan.currentPlan === planId && activePlan.currentTask === taskId) {
      const actionIndex = task.atomicActions.findIndex(a => a.id === actionId);
      activePlan.currentAction = actionIndex;
      activePlan.lastUpdated = new Date().toISOString();
      this.writeJSON(path.join(this.currentDir, 'active-plan.json'), activePlan);
    }

    plan.updatedAt = new Date().toISOString();
    this.writeJSON(path.join(this.plansDir, `${planId}.json`), plan);

    return { success: true, actionId, completed };
  }

  getNextAction(planId, taskId) {
    const plan = this.getPlan(planId);
    if (plan.error) return plan;

    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) {
      return { error: `Task ${taskId} not found` };
    }

    const nextAction = task.atomicActions.find(a => !a.completed);
    return nextAction || { message: 'All actions completed' };
  }

  // Progress tracking
  getStatus() {
    const activePlan = this.getActivePlan();
    if (!activePlan || !activePlan.currentPlan) {
      return { message: 'No active plan' };
    }

    const plan = this.getPlan(activePlan.currentPlan);
    if (plan.error) return plan;

    const status = {
      activePlan: {
        id: plan.id,
        name: plan.name,
        currentTask: activePlan.currentTask,
        currentAction: activePlan.currentAction,
        lastUpdated: activePlan.lastUpdated
      },
      progress: {
        totalTasks: plan.tasks.length,
        completed: plan.tasks.filter(t => t.status === 'DONE').length,
        inProgress: plan.tasks.filter(t => t.status === 'IN_PROGRESS').length,
        blocked: plan.tasks.filter(t => t.status === 'BLOCKED').length,
        pending: plan.tasks.filter(t => t.status === 'PENDING').length
      }
    };

    if (activePlan.currentTask) {
      const currentTask = plan.tasks.find(t => t.id === activePlan.currentTask);
      if (currentTask) {
        const completedActions = currentTask.atomicActions.filter(a => a.completed).length;
        status.currentTaskProgress = {
          taskId: currentTask.id,
          title: currentTask.title,
          totalActions: currentTask.atomicActions.length,
          completedActions: completedActions,
          percentComplete: Math.round((completedActions / currentTask.atomicActions.length) * 100)
        };
      }
    }

    status.blockers = activePlan.blockers || [];

    return status;
  }

  // Note management
  addNote(planId, taskId, note, type = 'info') {
    const plan = this.getPlan(planId);
    if (plan.error) return plan;

    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) {
      return { error: `Task ${taskId} not found` };
    }

    task.implementationNotes = task.implementationNotes || [];
    task.implementationNotes.push({
      timestamp: new Date().toISOString(),
      note,
      type
    });

    plan.updatedAt = new Date().toISOString();
    this.writeJSON(path.join(this.plansDir, `${planId}.json`), plan);

    return { success: true };
  }

  // Blocker management
  addBlocker(taskId, reason) {
    const activePlan = this.getActivePlan();
    if (!activePlan) {
      return { error: 'No active plan' };
    }

    activePlan.blockers = activePlan.blockers || [];
    activePlan.blockers.push({
      taskId,
      reason,
      timestamp: new Date().toISOString(),
      resolved: false
    });

    this.writeJSON(path.join(this.currentDir, 'active-plan.json'), activePlan);
    return { success: true };
  }
}

// CLI Interface
if (require.main === module) {
  const pm = new PlanManager();
  const [command, ...args] = process.argv.slice(2);

  const commands = {
    // Plan management
    'create-plan': () => {
      const [id, name, description] = args;
      if (!id || !name) {
        console.log('Usage: create-plan <id> <name> [description]');
        return;
      }
      console.log(pm.createPlan({ id, name, description }));
    },

    'list-plans': () => {
      const plans = pm.listPlans();
      console.log('\nAvailable Plans:');
      plans.forEach(p => {
        console.log(`\n${p.id}: ${p.name}`);
        console.log(`  Tasks: ${p.completed}/${p.taskCount} completed`);
        console.log(`  Created: ${p.createdAt}`);
      });
    },

    'set-active': () => {
      const [planId] = args;
      if (!planId) {
        console.log('Usage: set-active <planId>');
        return;
      }
      console.log(pm.setActivePlan(planId));
    },

    // Task management
    'next-task': () => {
      const activePlan = pm.getActivePlan();
      if (!activePlan || !activePlan.currentPlan) {
        console.log('No active plan. Use set-active <planId>');
        return;
      }
      const task = pm.getNextTask(activePlan.currentPlan);
      console.log(JSON.stringify(task, null, 2));
    },

    'start-task': () => {
      const [taskId] = args;
      const activePlan = pm.getActivePlan();
      if (!activePlan || !activePlan.currentPlan) {
        console.log('No active plan');
        return;
      }
      console.log(pm.updateTaskStatus(activePlan.currentPlan, taskId, 'IN_PROGRESS'));
    },

    'complete-task': () => {
      const [taskId, ...noteWords] = args;
      const notes = noteWords.join(' ');
      const activePlan = pm.getActivePlan();
      if (!activePlan || !activePlan.currentPlan) {
        console.log('No active plan');
        return;
      }
      console.log(pm.updateTaskStatus(activePlan.currentPlan, taskId, 'DONE', notes));
    },

    'block-task': () => {
      const [taskId, ...reasonWords] = args;
      const reason = reasonWords.join(' ');
      const activePlan = pm.getActivePlan();
      if (!activePlan || !activePlan.currentPlan) {
        console.log('No active plan');
        return;
      }
      pm.updateTaskStatus(activePlan.currentPlan, taskId, 'BLOCKED', reason);
      console.log(pm.addBlocker(taskId, reason));
    },

    // Action management
    'complete-action': () => {
      const [taskId, actionId, ...noteWords] = args;
      const notes = noteWords.join(' ');
      const activePlan = pm.getActivePlan();
      if (!activePlan || !activePlan.currentPlan) {
        console.log('No active plan');
        return;
      }
      console.log(pm.updateActionStatus(activePlan.currentPlan, taskId, actionId, true, notes));
    },

    'next-action': () => {
      const activePlan = pm.getActivePlan();
      if (!activePlan || !activePlan.currentPlan || !activePlan.currentTask) {
        console.log('No active task');
        return;
      }
      const action = pm.getNextAction(activePlan.currentPlan, activePlan.currentTask);
      console.log(JSON.stringify(action, null, 2));
    },

    // Status and notes
    'status': () => {
      const status = pm.getStatus();
      console.log(JSON.stringify(status, null, 2));
    },

    'add-note': () => {
      const [taskId, ...noteWords] = args;
      const note = noteWords.join(' ');
      const activePlan = pm.getActivePlan();
      if (!activePlan || !activePlan.currentPlan) {
        console.log('No active plan');
        return;
      }
      console.log(pm.addNote(activePlan.currentPlan, taskId, note));
    },

    'help': () => {
      console.log(`
Rex Tracker Light - Plan Manager

Plan Management:
  create-plan <id> <name> [description]  Create a new plan
  list-plans                             List all available plans
  set-active <planId>                    Set the active plan

Task Management:
  next-task                              Get the next available task
  start-task <taskId>                    Mark a task as IN_PROGRESS
  complete-task <taskId> [notes]         Mark a task as DONE
  block-task <taskId> <reason>           Mark a task as BLOCKED

Action Management:
  complete-action <taskId> <actionId> [notes]  Mark an action as complete
  next-action                                  Get the next action for current task

Status and Notes:
  status                                 Show current status
  add-note <taskId> <note>              Add a note to a task

Example workflow:
  1. set-active my-plan
  2. next-task
  3. start-task TASK001
  4. complete-action TASK001 ACTION001
  5. complete-action TASK001 ACTION002
  6. complete-task TASK001 "All tests passing"
`);
    }
  };

  const cmd = commands[command] || commands.help;
  cmd();
}

module.exports = PlanManager;