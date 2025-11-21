/**
 * Backend entry point for our Conductor App.
 * Defines health check routes and initializes the Express server.
 * @module server
 */
// Basic Express server to serve static frontend and prepare for backend features
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve static assets (e.g., logos, images)
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));


// Serve static files for each role page
app.use('/login_page', express.static(path.join(__dirname, '../frontend/src/pages/login_page')));
app.use('/login', express.static(path.join(__dirname, '../frontend/src/pages/login_page'), { index: 'login.html' }));
app.get('/login/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/login_page/login.html'));
});
app.use('/team_card', express.static(path.join(__dirname, '../frontend/src/pages/team_card')));
app.use('/new_user', express.static(path.join(__dirname, '../frontend/src/pages/new_user')));
app.use('/task_tracker', express.static(path.join(__dirname, '../frontend/src/pages/task_tracker'))); 
app.use('/tutor', express.static(path.join(__dirname, '../frontend/src/pages/tutor')));
app.use('/dashboards', express.static(path.join(__dirname, '../frontend/src/pages/dashboards')));
app.use('/profile_page', express.static(path.join(__dirname, '../frontend/src/pages/profile_page')));
/**
 * Health check endpoint.
 * @function healthCheck
 * @memberof module:server
 * @param {Object} _req - Express request (unused)
 * @param {Object} res - Express response
 */
function healthCheck(_req, res) {
  res.json({ status: 'ok' });
}

app.get('/api/health', healthCheck);

// Test endpoint to verify server is receiving requests
app.get('/api/test', (req, res) => {
  console.log('✅ Test endpoint called at', new Date().toISOString());
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Helper function to read teams
function getTeams() {
  const filePath = path.join(__dirname, 'data', 'teams.json');
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}
// Helper function to write teams back to file
function saveTeams(teams) {
  const filePath = path.join(__dirname, 'data', 'teams.json');
  fs.writeFileSync(filePath, JSON.stringify(teams, null, 2), 'utf8');
}

// Helper function to read tasks
function getTasks() {
  const filePath = path.join(__dirname, 'data', 'tasks.json');
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

// Helper function to write tasks back to file
function saveTasks(tasks) {
  const filePath = path.join(__dirname, 'data', 'tasks.json');
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), 'utf8');
}

// Helper function to read members
function getMembers() {
  const filePath = path.join(__dirname, 'data', 'members.json');
  if (!fs.existsSync(filePath)) {
    console.error('members.json file not found');
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading members.json:', error);
    return [];
  }
}

// Helper function to read GitHub config
function getGitHubConfig() {
  const filePath = path.join(__dirname, 'data', 'github-config.json');
  
  if (!fs.existsSync(filePath)) {
    return { owner: '', repo: '', projectId: '' };
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(data);
    
    return {
      owner: (config.owner !== undefined && config.owner !== null) ? String(config.owner).trim() : '',
      repo: (config.repo !== undefined && config.repo !== null) ? String(config.repo).trim() : '',
      projectId: (config.projectId !== undefined && config.projectId !== null) ? String(config.projectId).trim() : ''
    };
  } catch (error) {
    console.error('Error reading github-config.json:', error);
    return { owner: '', repo: '', projectId: '' };
  }
}

// Helper function to get GitHub token from environment variable
function getGitHubToken() {
  return process.env.GITHUB_TOKEN || '';
}

// Helper function to save GitHub config
function saveGitHubConfig(config) {
  const filePath = path.join(__dirname, 'data', 'github-config.json');
  
  const configToSave = {
    owner: (config.owner !== undefined && config.owner !== null) ? String(config.owner).trim() : '',
    repo: (config.repo !== undefined && config.repo !== null) ? String(config.repo).trim() : '',
    projectId: (config.projectId !== undefined && config.projectId !== null) ? String(config.projectId).trim() : ''
  };
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(configToSave, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing config file:', error);
    throw error;
  }
}

// Helper function to fetch GitHub issues
async function fetchGitHubIssues(owner, repo, token = '') {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Conductor-App'
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const issues = await response.json();
    
    // Filter out pull requests (they have pull_request property)
    return issues.filter(issue => !issue.pull_request);
  } catch (error) {
    console.error('Error fetching GitHub issues:', error);
    throw error;
  }
}

// Helper function to fetch GitHub Projects v2 items using GraphQL (similar to script.py)
async function fetchGitHubProjectV2Items(org, projectNumber, token = '') {
  try {
    if (!org || !projectNumber) {
      throw new Error('Organization and project number are required for Projects v2');
    }

    if (!token || token.trim() === '') {
      throw new Error('GitHub token is required for accessing projects. Please set GITHUB_TOKEN in your .env file.');
    }

    const graphqlQuery = `
      query($org: String!, $number: Int!, $after: String) {
        organization(login: $org) {
          projectV2(number: $number) {
            title
            items(first: 100, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                content {
                  __typename
                  ... on Issue {
                    number
                    title
                    url
                    state
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                    labels(first: 20) {
                      nodes {
                        name
                      }
                    }
                    milestone {
                      dueOn
                    }
                    repository {
                      nameWithOwner
                    }
                  }
                  ... on PullRequest {
                    number
                    title
                    url
                    state
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                    labels(first: 20) {
                      nodes {
                        name
                      }
                    }
                    milestone {
                      dueOn
                    }
                    repository {
                      nameWithOwner
                    }
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Conductor-App'
    };

    const allItems = [];
    let after = null;

    // Handle pagination
    while (true) {
      const variables = {
        org: org,
        number: parseInt(projectNumber, 10),
        after: after
      };

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: graphqlQuery, variables })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GraphQL API error: ${response.status} ${response.statusText}\nResponse: ${errorText.substring(0, 200)}`);
      }

      const result = await response.json();

      if (result.errors) {
        const errorMessages = result.errors.map(e => e.message).join(', ');
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      const project = result.data?.organization?.projectV2;
      if (!project) {
        throw new Error(`Project v2 not found. Organization: ${org}, Project Number: ${projectNumber}`);
      }

      const items = project.items;
      allItems.push(...items.nodes);

      if (!items.pageInfo.hasNextPage) {
        break;
      }
      after = items.pageInfo.endCursor;
    }


    // Process items and extract status
    const itemsWithStatus = [];
    for (const node of allItems) {
      const content = node.content;
      if (!content) continue;

      // Skip PRs, only process Issues
      if (content.__typename === 'PullRequest') {
        continue;
      }

      // Extract status from fieldValues
      let status = 'No Status';
      for (const fv of node.fieldValues.nodes) {
        if (fv.__typename === 'ProjectV2ItemFieldSingleSelectValue') {
          if (fv.field && fv.field.name === 'Status') {
            status = fv.name;
            break;
          }
        }
      }

      // Convert GraphQL Issue to REST API format for compatibility
      const issueData = {
        number: content.number,
        title: content.title,
        html_url: content.url,
        state: content.state,
        assignee: content.assignees?.nodes?.[0] ? { login: content.assignees.nodes[0].login } : null,
        labels: content.labels?.nodes?.map(l => ({ name: l.name })) || [],
        milestone: content.milestone ? { due_on: content.milestone.dueOn } : null,
        repository: { nameWithOwner: content.repository?.nameWithOwner }
      };

      itemsWithStatus.push({
        content: issueData,
        status: status
      });
    }

    return itemsWithStatus;
  } catch (error) {
    console.error('Error fetching GitHub Projects v2 items:', error);
    throw error;
  }
}

// Helper function to fetch GitHub Project items with their column status (Projects v1 - Classic)
async function fetchGitHubProjectItems(projectId, token = '') {
  try {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    if (!token || token.trim() === '') {
      throw new Error('GitHub token is required for accessing projects. Please set GITHUB_TOKEN in your .env file.');
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Conductor-App',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': `Bearer ${token}`
    };

    // Get project columns first
    // Note: This endpoint is for classic projects (Projects v1)
    // For Projects v2, you need to use GraphQL API or different REST endpoints
    const columnsUrl = `https://api.github.com/projects/${projectId}/columns?per_page=100`;
    const columnsResponse = await fetch(columnsUrl, { headers });
    
    if (!columnsResponse.ok) {
      // Provide more helpful error messages
      if (columnsResponse.status === 404) {
        const errorBody = await columnsResponse.text();
        let errorMessage = `GitHub Projects API error: 404 Not Found\n\n`;
        errorMessage += `Possible causes:\n`;
        errorMessage += `1. Project ID "${projectId}" is incorrect. Classic projects use numeric IDs.\n`;
        errorMessage += `2. This might be a Projects v2 project (new GitHub Projects), which requires GraphQL API.\n`;
        errorMessage += `3. The project doesn't exist or you don't have access to it.\n`;
        errorMessage += `4. The token doesn't have the required permissions (needs 'repo' scope for private repos).\n\n`;
        errorMessage += `To find your classic project ID:\n`;
        errorMessage += `- Go to your project: https://github.com/orgs/OWNER/projects/PROJECT_NUMBER\n`;
        errorMessage += `- The project ID is in the URL or you can get it via API: GET /orgs/:org/projects\n\n`;
        errorMessage += `For Projects v2, you'll need to use GraphQL API or the project number instead of ID.`;
        throw new Error(errorMessage);
      } else if (columnsResponse.status === 401) {
        throw new Error('GitHub API authentication failed. Please check your token and ensure it has the "repo" scope for private repositories.');
      } else if (columnsResponse.status === 403) {
        throw new Error('GitHub API access forbidden. Your token may not have the required permissions. Ensure it has "repo" scope for private repositories.');
      } else {
        const errorText = await columnsResponse.text();
        throw new Error(`GitHub Projects API error: ${columnsResponse.status} ${columnsResponse.statusText}\nResponse: ${errorText.substring(0, 200)}`);
      }
    }

    const columns = await columnsResponse.json();
    
    const allItemsWithStatus = [];
    
    // Process each column
    for (const column of columns) {
      const cardsUrl = `https://api.github.com/projects/columns/${column.id}/cards?per_page=100`;
      let cardsResponse = await fetch(cardsUrl, { headers });
      
      if (!cardsResponse.ok) {
        continue;
      }
      
      // Handle pagination
      let allCards = [];
      while (cardsResponse.ok) {
        const cards = await cardsResponse.json();
        allCards = allCards.concat(cards);
        
        // Check for pagination
        const linkHeader = cardsResponse.headers.get('link');
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            cardsResponse = await fetch(nextMatch[1], { headers });
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      // For each card in this column, fetch its content
      for (const card of allCards) {
        if (card.content_url) {
          try {
            const contentResponse = await fetch(card.content_url, { headers });
            if (contentResponse.ok) {
              const content = await contentResponse.json();
              
              // Only process if it's an issue (not a PR)
              if (!content.pull_request) {
                allItemsWithStatus.push({
                  item: { content_url: card.content_url, content_id: card.content_id },
                  content: content,
                  columnName: column.name
                });
              }
            }
          } catch (error) {
            // Continue with next card
          }
        }
      }
    }
    
    return allItemsWithStatus;
  } catch (error) {
    console.error('Error fetching GitHub project items:', error);
    throw error;
  }
}

// Helper function to map GitHub issue to task format
function mapGitHubIssueToTask(issue) {
  // Map GitHub issue state to task tracker columns
  let _group = 'todo';
  if (issue.state === 'closed') {
    _group = 'done';
  } else if (issue.labels && issue.labels.some(label => 
    label.name.toLowerCase().includes('in-progress') || 
    label.name.toLowerCase().includes('progress') ||
    label.name.toLowerCase().includes('doing')
  )) {
    _group = 'progress';
  }

  // Extract assignee name (map GitHub username to member name if possible)
  let assignee = 'None';
  if (issue.assignee) {
    assignee = issue.assignee.login;
    // Try to match with members list
    const members = getMembers();
    const matchedMember = members.find(m => 
      m.name.toLowerCase().includes(issue.assignee.login.toLowerCase()) ||
      issue.assignee.login.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
    );
    if (matchedMember) {
      assignee = matchedMember.name;
    }
  }
  
  // Extract difficulty from labels (easy, medium, hard)
  let badge = 'medium';
  if (issue.labels) {
    const labelNames = issue.labels.map(l => l.name.toLowerCase());
    if (labelNames.some(n => n.includes('easy') || n.includes('low') || n.includes('trivial'))) {
      badge = 'easy';
    } else if (labelNames.some(n => n.includes('hard') || n.includes('high') || n.includes('difficult'))) {
      badge = 'hard';
    }
  }

  // Format due date (if milestone exists)
  let due = 'TBD';
  if (issue.milestone && issue.milestone.due_on) {
    const dueDate = new Date(issue.milestone.due_on);
    due = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return {
    title: issue.title,
    badge: badge,
    due: issue.state === 'closed' ? 'Completed' : due,
    assignee: assignee,
    githubIssueNumber: issue.number,
    githubUrl: issue.html_url,
    githubState: issue.state
  };
}

// Helper function to map project column name to task tracker group
function mapColumnNameToGroup(columnName) {
  if (!columnName) {
    return 'todo';
  }
  
  const lowerName = columnName.toLowerCase().trim();
  
  // Map common column names to task tracker groups
  // Check for "done" variations first (most specific)
  if (lowerName === 'done' || lowerName === 'completed' || lowerName === 'complete' ||
      lowerName.includes('done') || lowerName.includes('completed') || lowerName.includes('complete')) {
    return 'done';
  } 
  // Check for "in progress" variations
  else if (lowerName === 'in progress' || lowerName === 'progress' || 
           lowerName.startsWith('in progress') || 
           (lowerName.includes('progress') && !lowerName.includes('no progress')) ||
           lowerName.includes('doing') || lowerName.includes('working') ||
           lowerName === 'in-progress' || lowerName === 'inprogress') {
    return 'progress';
  } 
  // Default to todo
  else {
    return 'todo';
  }
}

// Helper function to map Projects v2 status field value to task tracker group
function mapStatusToGroup(status) {
  if (!status || status === 'No Status') {
    return 'todo';
  }
  
  const lowerStatus = status.toLowerCase().trim();
  
  // Map common status values to task tracker groups
  // Check for "done" variations first (most specific)
  if (lowerStatus === 'done' || lowerStatus === 'completed' || lowerStatus === 'complete' ||
      lowerStatus.includes('done') || lowerStatus.includes('completed') || lowerStatus.includes('complete')) {
    return 'done';
  } 
  // Check for "in progress" variations
  else if (lowerStatus === 'in progress' || lowerStatus === 'progress' || 
           lowerStatus.startsWith('in progress') || 
           (lowerStatus.includes('progress') && !lowerStatus.includes('no progress')) ||
           lowerStatus.includes('doing') || lowerStatus.includes('working') ||
           lowerStatus === 'in-progress' || lowerStatus === 'inprogress') {
    return 'progress';
  } 
  // Default to todo
  else {
    return 'todo';
  }
}

// Helper function to map GitHub project item to task format (Projects v1 - Classic)
function mapGitHubProjectItemToTask(projectItem) {
  const item = projectItem.item;
  const content = projectItem.content;
  const columnName = projectItem.columnName;
  
  // Skip if not an issue (could be a PR)
  if (!content || content.pull_request) {
    return null;
  }
  
  // Map column name to task tracker group
  const group = mapColumnNameToGroup(columnName);
  
  // Extract assignee name (map GitHub username to member name if possible)
  let assignee = 'None';
  if (content.assignee) {
    assignee = content.assignee.login;
    // Try to match with members list
    const members = getMembers();
    const matchedMember = members.find(m => 
      m.name.toLowerCase().includes(content.assignee.login.toLowerCase()) ||
      content.assignee.login.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
    );
    if (matchedMember) {
      assignee = matchedMember.name;
    }
  }
  
  // Extract difficulty from labels (easy, medium, hard)
  let badge = 'medium';
  if (content.labels) {
    const labelNames = content.labels.map(l => l.name.toLowerCase());
    if (labelNames.some(n => n.includes('easy') || n.includes('low') || n.includes('trivial'))) {
      badge = 'easy';
    } else if (labelNames.some(n => n.includes('hard') || n.includes('high') || n.includes('difficult'))) {
      badge = 'hard';
    }
  }

  // Format due date (if milestone exists)
  let due = 'TBD';
  if (content.milestone && content.milestone.due_on) {
    const dueDate = new Date(content.milestone.due_on);
    due = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return {
    title: content.title,
    badge: badge,
    due: content.state === 'closed' ? 'Completed' : due,
    assignee: assignee,
    githubIssueNumber: content.number,
    githubUrl: content.html_url,
    githubState: content.state,
    _group: group // Store the mapped group
  };
}

// Helper function to map GitHub Projects v2 item to task format
function mapGitHubProjectV2ItemToTask(projectV2Item) {
  const content = projectV2Item.content;
  const status = projectV2Item.status;
  
  // Skip if not an issue (could be a PR)
  if (!content || content.state === 'closed' && content.pull_request) {
    return null;
  }
  
  // Map status to task tracker group
  const group = mapStatusToGroup(status);
  
  // Extract assignee name (map GitHub username to member name if possible)
  let assignee = 'None';
  if (content.assignee) {
    assignee = content.assignee.login;
    // Try to match with members list
    const members = getMembers();
    const matchedMember = members.find(m => 
      m.name.toLowerCase().includes(content.assignee.login.toLowerCase()) ||
      content.assignee.login.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
    );
    if (matchedMember) {
      assignee = matchedMember.name;
    }
  }
  
  // Extract difficulty from labels (easy, medium, hard)
  let badge = 'medium';
  if (content.labels && content.labels.length > 0) {
    const labelNames = content.labels.map(l => l.name.toLowerCase());
    if (labelNames.some(n => n.includes('easy') || n.includes('low') || n.includes('trivial'))) {
      badge = 'easy';
    } else if (labelNames.some(n => n.includes('hard') || n.includes('high') || n.includes('difficult'))) {
      badge = 'hard';
    }
  }

  // Format due date (if milestone exists)
  let due = 'TBD';
  if (content.milestone && content.milestone.due_on) {
    const dueDate = new Date(content.milestone.due_on);
    due = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return {
    title: content.title,
    badge: badge,
    due: content.state === 'closed' ? 'Completed' : due,
    assignee: assignee,
    githubIssueNumber: content.number,
    githubUrl: content.html_url,
    githubState: content.state,
    _group: group // Store the mapped group
  };
}

// GET all teams - hardcoded data for now
app.get('/api/teams', (req, res) => {
  const teams = getTeams();
  res.json(teams);
});

// GET single team by ID
app.get('/api/teams/:id', (req, res) => {
  const teamId = parseInt(req.params.id);
  const teams = getTeams();
  const team = teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  res.json(team);
});

// POST - Create a new team
app.post('/api/teams', (req, res) => {
  const teams = getTeams();
  
  // Find the highest ID and add 1 for the new team
  const maxId = teams.length > 0 ? Math.max(...teams.map(t => t.id)) : 0;
  const newId = maxId + 1;
  
  // Create new team object
  const newTeam = {
    id: newId,
    teamNumber: req.body.teamNumber || `Team ${newId}`,
    name: req.body.name || '',
    status: req.body.status || 'Needs Review',
    description: req.body.description || '',
    members: req.body.members || [],
    ...(req.body.nextSync && { nextSync: req.body.nextSync }),
    ...(req.body.lastUpdate && { lastUpdate: req.body.lastUpdate }),
    ...(req.body.actionRequired && { actionRequired: req.body.actionRequired })
  };
  
  // Add new team to array
  teams.push(newTeam);
  
  // Save to file
  saveTeams(teams);
  
  // Return the newly created team
  res.status(201).json(newTeam);
});

// PUT - Update an existing team
app.put('/api/teams/:id', (req, res) => {
  const teamId = parseInt(req.params.id);
  const teams = getTeams();
  
  // Find the team to update
  const teamIndex = teams.findIndex(t => t.id === teamId);
  
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Update the team with new data (merge with existing)
  const updatedTeam = {
    ...teams[teamIndex],
    ...req.body,
    id: teamId // Ensure ID can't be changed
  };
  
  teams[teamIndex] = updatedTeam;
  
  // Save to file
  saveTeams(teams);
  
  // Return the updated team
  res.json(updatedTeam);
});

// GET all members
app.get('/api/members', (req, res) => {
  const members = getMembers();
  res.json(members);
});

// GET all tasks
app.get('/api/tasks', (req, res) => {
  const tasks = getTasks();
  res.json(tasks);
});

// PUT - Update tasks (replace entire tasks object)
app.put('/api/tasks', (req, res) => {
  const tasks = req.body;
  saveTasks(tasks);
  res.json(tasks);
});

// GET GitHub configuration
app.get('/api/github/config', (req, res) => {
  const config = getGitHubConfig();
  
  // Token is stored in .env, not sent to frontend
  const response = { 
    owner: config.owner || '', 
    repo: config.repo || '', 
    projectId: config.projectId || '' 
  };
  
  res.json(response);
});

// POST - Update GitHub configuration
app.post('/api/github/config', (req, res) => {
  // Get existing config to preserve projectId if not provided
  const existingConfig = getGitHubConfig();
  
  // Extract values - handle undefined, null, and empty strings properly
  const owner = req.body.owner ? String(req.body.owner).trim() : '';
  const repo = req.body.repo ? String(req.body.repo).trim() : '';
  // projectId: use provided value, or preserve existing if not provided/empty
  let projectId = '';
  if (req.body.projectId !== undefined && req.body.projectId !== null && req.body.projectId !== '') {
    projectId = String(req.body.projectId).trim();
  } else {
    // Preserve existing projectId if not provided in request
    projectId = existingConfig.projectId || '';
  }
  
  // Create config object - token is stored in .env, not in config file
  const config = {
    owner: owner || '',
    repo: repo || '',
    projectId: projectId || ''
  };
  
  // Save to file
  saveGitHubConfig(config);
  
  // Return the saved values
  const savedConfig = getGitHubConfig();
  res.json({ 
    owner: savedConfig.owner, 
    repo: savedConfig.repo, 
    projectId: savedConfig.projectId || '', 
    message: 'Configuration saved' 
  });
});

// GET - Fetch GitHub issues and return as tasks
app.get('/api/github/issues', async (req, res) => {
  try {
    const config = getGitHubConfig();
    
    if (!config.owner || !config.repo) {
      return res.status(400).json({ 
        error: 'GitHub repository not configured. Please set owner and repo.' 
      });
    }

    const issues = await fetchGitHubIssues(config.owner, config.repo, config.token);
    const mappedTasks = issues.map(mapGitHubIssueToTask);
    
    res.json({
      issues: mappedTasks,
      count: mappedTasks.length,
      repo: `${config.owner}/${config.repo}`
    });
  } catch (error) {
    console.error('Error fetching GitHub issues:', error);
    res.status(500).json({ 
      error: 'Failed to fetch GitHub issues', 
      message: error.message 
    });
  }
});

// Helper function to find Projects v2 project using GraphQL
async function findProjectV2ByNumber(owner, projectNumber, token) {
  const graphqlQuery = `
    query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          id
          title
          number
          url
        }
      }
    }
  `;

  const variables = {
    org: owner,
    number: parseInt(projectNumber, 10)
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Conductor-App'
  };

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ query: graphqlQuery, variables })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GraphQL API error: ${response.status} ${response.statusText}\nResponse: ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    const errorMessages = result.errors.map(e => e.message).join(', ');
    throw new Error(`GraphQL errors: ${errorMessages}`);
  }

  if (result.data && result.data.organization && result.data.organization.projectV2) {
    const project = result.data.organization.projectV2;
    return {
      id: project.id,
      number: project.number,
      name: project.title,
      url: project.url,
      type: 'v2'
    };
  }

  return null;
}

// GET - Helper endpoint to find project ID from organization and project number
app.get('/api/github/project/find-id', async (req, res) => {
  try {
    const config = getGitHubConfig();
    const projectNumber = req.query.projectNumber || req.query.number;
    
    if (!config.owner || !config.owner.trim()) {
      return res.status(400).json({ 
        error: 'Organization owner not configured',
        message: 'Please set the owner (organization name) in GitHub configuration'
      });
    }

    if (!projectNumber) {
      return res.status(400).json({ 
        error: 'Project number required',
        message: 'Please provide projectNumber query parameter (e.g., ?projectNumber=1)'
      });
    }

    const token = getGitHubToken();
    if (!token || token.trim() === '') {
      return res.status(400).json({ 
        error: 'GitHub token is required',
        message: 'A GitHub personal access token is required. Please set GITHUB_TOKEN in your .env file.'
      });
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Conductor-App',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': `Bearer ${token}`
    };

    // First, try to find it as a Projects v2 (new GitHub Projects) using GraphQL
    console.log(`Attempting to find project as Projects v2 (GraphQL)...`);
    try {
      const v2Project = await findProjectV2ByNumber(config.owner, projectNumber, getGitHubToken());
      if (v2Project) {
        console.log(`✓ Found as Projects v2: ${v2Project.name} (ID: ${v2Project.id})`);
        return res.json({
          success: true,
          projectNumber: v2Project.number,
          projectId: v2Project.id,
          projectName: v2Project.name,
          projectUrl: v2Project.url,
          projectType: 'v2',
          message: `Found Projects v2 project: "${v2Project.name}" (ID: ${v2Project.id}, Number: ${v2Project.number}). Note: Projects v2 requires GraphQL API support.`
        });
      }
    } catch (v2Error) {
      console.log(`Projects v2 lookup failed: ${v2Error.message}`);
      // Continue to try classic projects
    }

    // If not found as v2, try classic projects
    console.log(`Attempting to find project as classic project (REST API)...`);
    const projectsUrl = `https://api.github.com/orgs/${config.owner}/projects?per_page=100`;
    const projectsResponse = await fetch(projectsUrl, { headers });
    
    if (!projectsResponse.ok) {
      if (projectsResponse.status === 404) {
        const errorText = await projectsResponse.text();
        let errorMessage = `Organization "${config.owner}" not found or you don't have access to it.\n\n`;
        errorMessage += `Possible issues:\n`;
        errorMessage += `1. The organization name is incorrect\n`;
        errorMessage += `2. Your token doesn't have access to this organization\n`;
        errorMessage += `3. The organization may have restrictions on third-party access\n`;
        errorMessage += `4. This might be a Projects v2 project (tried GraphQL but failed)\n\n`;
        errorMessage += `Response: ${errorText.substring(0, 200)}`;
        throw new Error(errorMessage);
      } else if (projectsResponse.status === 401) {
        throw new Error('GitHub API authentication failed. Please check your token and ensure it has the required scopes.');
      } else if (projectsResponse.status === 403) {
        const errorText = await projectsResponse.text();
        let errorMessage = 'GitHub API access forbidden. Possible causes:\n';
        errorMessage += '1. Your token may not have the required permissions (needs "read:org" scope)\n';
        errorMessage += '2. The organization may have restrictions on third-party access\n';
        errorMessage += '3. Your organization may require OAuth app instead of personal access token\n';
        errorMessage += `\nResponse: ${errorText.substring(0, 200)}`;
        throw new Error(errorMessage);
      } else {
        const errorText = await projectsResponse.text();
        throw new Error(`GitHub API error: ${projectsResponse.status} ${projectsResponse.statusText}\nResponse: ${errorText.substring(0, 200)}`);
      }
    }

    const projects = await projectsResponse.json();
    const projectNumberInt = parseInt(projectNumber, 10);
    
    // Find the project with matching number
    const matchingProject = projects.find(p => p.number === projectNumberInt);
    
    if (!matchingProject) {
      return res.status(404).json({ 
        error: 'Project not found',
        message: `Project number ${projectNumber} not found in organization ${config.owner}.\n\n` +
                 `Searched:\n` +
                 `- Projects v2 (GraphQL): Not found\n` +
                 `- Classic projects (REST): Found ${projects.length} project(s), but none match number ${projectNumber}\n\n` +
                 `This might be:\n` +
                 `1. A Projects v2 project that requires different authentication\n` +
                 `2. A project you don't have access to\n` +
                 `3. The project number is incorrect`,
        availableProjects: projects.map(p => ({ number: p.number, name: p.name, id: p.id, type: 'classic' }))
      });
    }

    res.json({
      success: true,
      projectNumber: matchingProject.number,
      projectId: matchingProject.id,
      projectName: matchingProject.name,
      projectUrl: matchingProject.html_url,
      projectType: 'classic',
      message: `Found classic project: "${matchingProject.name}" (ID: ${matchingProject.id}, Number: ${matchingProject.number})`
    });
  } catch (error) {
    console.error('Error finding project ID:', error);
    res.status(500).json({ 
      error: 'Failed to find project ID', 
      message: error.message 
    });
  }
});

// GET - Diagnostic endpoint to test organization access and list available projects
app.get('/api/github/project/diagnose', async (req, res) => {
  try {
    const config = getGitHubConfig();
    
    if (!config.owner || !config.owner.trim()) {
      return res.status(400).json({ 
        error: 'Organization owner not configured',
        message: 'Please set the owner (organization name) in GitHub configuration'
      });
    }

    const token = getGitHubToken();
    if (!token || token.trim() === '') {
      return res.status(400).json({ 
        error: 'GitHub token is required',
        message: 'A GitHub personal access token is required. Please set GITHUB_TOKEN in your .env file.'
      });
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Conductor-App',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': `Bearer ${token}`
    };

    const results = {
      organization: config.owner,
      tokenConfigured: !!token,
      tests: {}
    };

    // Test 1: Check organization access
    try {
      const orgUrl = `https://api.github.com/orgs/${config.owner}`;
      const orgResponse = await fetch(orgUrl, { headers });
      results.tests.organizationAccess = {
        status: orgResponse.status,
        ok: orgResponse.ok,
        message: orgResponse.ok ? 'Organization accessible' : `Error: ${orgResponse.status} ${orgResponse.statusText}`
      };
    } catch (error) {
      results.tests.organizationAccess = {
        status: 'error',
        ok: false,
        message: error.message
      };
    }

    // Test 2: List classic projects
    try {
      const projectsUrl = `https://api.github.com/orgs/${config.owner}/projects?per_page=100`;
      const projectsResponse = await fetch(projectsUrl, { headers });
      if (projectsResponse.ok) {
        const projects = await projectsResponse.json();
        results.tests.classicProjects = {
          status: projectsResponse.status,
          ok: true,
          count: projects.length,
          projects: projects.map(p => ({ number: p.number, name: p.name, id: p.id }))
        };
      } else {
        results.tests.classicProjects = {
          status: projectsResponse.status,
          ok: false,
          message: `${projectsResponse.status} ${projectsResponse.statusText}`
        };
      }
    } catch (error) {
      results.tests.classicProjects = {
        status: 'error',
        ok: false,
        message: error.message
      };
    }

    // Test 3: Test GraphQL access (for Projects v2)
    try {
      const graphqlQuery = `query($org: String!) { organization(login: $org) { login } }`;
      const graphqlResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Conductor-App'
        },
        body: JSON.stringify({ query: graphqlQuery, variables: { org: config.owner } })
      });
      
      if (graphqlResponse.ok) {
        const graphqlResult = await graphqlResponse.json();
        results.tests.graphqlAccess = {
          status: graphqlResponse.status,
          ok: !graphqlResult.errors,
          message: graphqlResult.errors ? graphqlResult.errors.map(e => e.message).join(', ') : 'GraphQL API accessible'
        };
      } else {
        results.tests.graphqlAccess = {
          status: graphqlResponse.status,
          ok: false,
          message: `${graphqlResponse.status} ${graphqlResponse.statusText}`
        };
      }
    } catch (error) {
      results.tests.graphqlAccess = {
        status: 'error',
        ok: false,
        message: error.message
      };
    }

    res.json(results);
  } catch (error) {
    console.error('Error in diagnose endpoint:', error);
    res.status(500).json({ 
      error: 'Diagnostic failed', 
      message: error.message 
    });
  }
});

// GET - Debug endpoint to list project columns (helps verify projectId and see column names)
app.get('/api/github/project/columns', async (req, res) => {
  try {
    const config = getGitHubConfig();
    
    if (!config.projectId || config.projectId.trim() === '') {
      return res.status(400).json({ 
        error: 'Project ID not configured',
        message: 'Please add projectId to GitHub configuration'
      });
    }

    const token = getGitHubToken();
    if (!token || token.trim() === '') {
      return res.status(400).json({ 
        error: 'GitHub token is required',
        message: 'A GitHub personal access token is required. Please set GITHUB_TOKEN in your .env file.'
      });
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Conductor-App',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': `Bearer ${token}`
    };

    const columnsUrl = `https://api.github.com/projects/${config.projectId}/columns?per_page=100`;
    const columnsResponse = await fetch(columnsUrl, { headers });
    
    if (!columnsResponse.ok) {
      // Provide more helpful error messages
      if (columnsResponse.status === 404) {
        const errorMessage = `GitHub Projects API error: 404 Not Found\n\n` +
          `Project ID "${config.projectId}" not found. Possible causes:\n` +
          `1. The project ID is incorrect\n` +
          `2. This might be a Projects v2 project (requires different API)\n` +
          `3. You don't have access to this project\n` +
          `4. The token doesn't have required permissions`;
        throw new Error(errorMessage);
      } else if (columnsResponse.status === 401) {
        throw new Error('GitHub API authentication failed. Please check your token.');
      } else if (columnsResponse.status === 403) {
        throw new Error('GitHub API access forbidden. Your token may not have the required permissions.');
      } else {
        const errorText = await columnsResponse.text();
        throw new Error(`GitHub Projects API error: ${columnsResponse.status} ${columnsResponse.statusText}\nResponse: ${errorText.substring(0, 200)}`);
      }
    }

    const columns = await columnsResponse.json();
    
    // For each column, get card count
    const columnsWithInfo = await Promise.all(columns.map(async (column) => {
      const cardsUrl = `https://api.github.com/projects/columns/${column.id}/cards?per_page=1`;
      const cardsResponse = await fetch(cardsUrl, { headers });
      let cardCount = 0;
      if (cardsResponse.ok) {
        const linkHeader = cardsResponse.headers.get('link');
        // Try to get total count from pagination or count cards
        const cards = await cardsResponse.json();
        cardCount = cards.length;
        // If there's a link header, there might be more
        if (linkHeader) {
          // This is a simplified count - for exact count, would need to paginate
          cardCount = cards.length > 0 ? 'many' : 0;
        }
      }
      return {
        id: column.id,
        name: column.name,
        cardCount: cardCount
      };
    }));
    
    res.json({
      projectId: config.projectId,
      columns: columnsWithInfo,
      count: columns.length
    });
  } catch (error) {
    console.error('Error fetching project columns:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project columns', 
      message: error.message 
    });
  }
});

// POST - Sync GitHub issues to tasks (import into task tracker)
app.post('/api/github/sync', async (req, res) => {
  try {
    const config = getGitHubConfig();
    
    if (!config.owner || !config.repo) {
      return res.status(400).json({ 
        error: 'GitHub repository not configured' 
      });
    }

    // If projectId/projectNumber is configured, use Projects API; otherwise fall back to Issues API
    let mappedTasks = [];
    let groupedTasks = { todo: [], progress: [], done: [] };
    let usedProjectsV2 = false;
    
    // Try Projects v2 first (using GraphQL with org and project number)
    // The projectId in config might be a project number for v2
    if (config.owner && config.projectId && config.projectId.trim() !== '') {
      const projectNumber = config.projectId.trim();
      
      // Validate token for private repos
      const token = getGitHubToken();
      if (!token || token.trim() === '') {
        return res.status(400).json({ 
          error: 'GitHub token is required',
          message: 'A GitHub personal access token is required. Please set GITHUB_TOKEN in your .env file.'
        });
      }
      
      // Try Projects v2 first (GraphQL)
      try {
        const projectV2Items = await fetchGitHubProjectV2Items(config.owner, projectNumber, token);
        
        if (projectV2Items.length > 0) {
          usedProjectsV2 = true;
          
          // Map Projects v2 items to tasks
          projectV2Items.forEach((projectItem) => {
            const task = mapGitHubProjectV2ItemToTask(projectItem);
            if (task) {
              const group = task._group;
              mappedTasks.push(task);
              groupedTasks[group].push(task);
              delete task._group;
            }
          });
        } else {
          throw new Error('No items found in Projects v2');
        }
      } catch (v2Error) {
        // Fall back to Projects v1 (Classic)
        try {
          const projectItems = await fetchGitHubProjectItems(projectNumber, token);
          
          // Map project items to tasks
          projectItems.forEach((projectItem) => {
            const task = mapGitHubProjectItemToTask(projectItem);
            if (task) {
              const group = task._group;
              mappedTasks.push(task);
              groupedTasks[group].push(task);
              delete task._group;
            }
          });
        } catch (v1Error) {
          console.error('Projects v1 also failed:', v1Error.message);
          throw new Error(`Both Projects v2 and v1 failed. v2 error: ${v2Error.message}, v1 error: ${v1Error.message}`);
        }
      }
    } else {
      // Fall back to Issues API (original behavior)
      const issues = await fetchGitHubIssues(config.owner, config.repo, getGitHubToken());
      mappedTasks = issues.map(mapGitHubIssueToTask);
      
      // Group tasks by their mapped group (todo, progress, done)
      mappedTasks.forEach(task => {
        // Determine group based on GitHub state and labels
        let group = 'todo';
        if (task.githubState === 'closed') {
          group = 'done';
        } else {
          // Check if issue has in-progress label
          const originalIssue = issues.find(i => i.number === task.githubIssueNumber);
          if (originalIssue && originalIssue.labels) {
            const labelNames = originalIssue.labels.map(l => l.name.toLowerCase());
            if (labelNames.some(n => n.includes('in-progress') || n.includes('progress') || n.includes('doing'))) {
              group = 'progress';
            }
          }
        }
        groupedTasks[group].push(task);
      });
    }
    
    // Get current tasks
    const currentTasks = getTasks();
    
    // Create a story point for GitHub issues if it doesn't exist
    const githubStoryName = `GitHub: ${config.owner}/${config.repo}`;
    if (!currentTasks[githubStoryName]) {
      currentTasks[githubStoryName] = { todo: [], progress: [], done: [] };
    }
    
    // Update the GitHub story with synced tasks
    currentTasks[githubStoryName] = groupedTasks;
    
    // Save tasks
    saveTasks(currentTasks);
    
      const message = config.projectId && config.projectId.trim() !== '' 
        ? (usedProjectsV2 ? 'GitHub Projects v2 items synced successfully' : 'GitHub Projects v1 items synced successfully')
        : 'GitHub issues synced successfully (Projects API not used - no projectId configured)';
      
      res.json({
        message: message,
        synced: mappedTasks.length,
        story: githubStoryName,
        usedProjectsApi: !!(config.projectId && config.projectId.trim() !== ''),
        usedProjectsV2: usedProjectsV2
      });
  } catch (error) {
    console.error('Sync error:', error.message);
    res.status(500).json({ 
      error: 'Failed to sync GitHub issues', 
      message: error.message 
    });
  }
});

// ============================================
// STATIC FILE SERVING - Must come AFTER API routes
// ============================================

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve static assets (e.g., logos, images)
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

// Serve static files for each role page
app.use('/login_page', express.static(path.join(__dirname, '../frontend/src/pages/login_page')));
app.use('/login', express.static(path.join(__dirname, '../frontend/src/pages/login_page'), { index: 'login.html' }));
app.get('/login/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/login_page/login.html'));
});
app.use('/team_card', express.static(path.join(__dirname, '../frontend/src/pages/team_card')));
app.use('/new_user', express.static(path.join(__dirname, '../frontend/src/pages/new_user')));
app.use('/task_tracker', express.static(path.join(__dirname, '../frontend/src/pages/task_tracker'))); 
app.use('/tutor', express.static(path.join(__dirname, '../frontend/src/pages/tutor')));
app.use('/dashboards', express.static(path.join(__dirname, '../frontend/src/pages/dashboards')));
app.use('/profile_page', express.static(path.join(__dirname, '../frontend/src/pages/profile_page')));
app.use('/evaluation_rubric', express.static(path.join(__dirname, '../frontend/src/pages/evaluation_rubric')));


// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Export app for testing
module.exports = app;

