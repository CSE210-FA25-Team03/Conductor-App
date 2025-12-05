// backend/services/githubApi.js
// GitHub API integration service for Projects v2

/**
 * Fetch GitHub issues from a repository (REST API)
 */
async function fetchGitHubIssues(owner, repo, token = '') {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Conductor-App',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Filter out pull requests (they have pull_request property)
  return data.filter((issue) => !issue.pull_request);
}

/**
 * Fetch GitHub issues from a Project v2 (GraphQL API)
 * Supports both direct project ID and organization + project number
 */
async function fetchGitHubProjectIssues(projectId, token, orgName = null, projectNumber = null) {
  if (!token) {
    throw new Error('GitHub token is required for Project API access');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Conductor-App',
  };

  let query, variables;

  // If org_name and project_number are provided, use organization-based query
  if (orgName && projectNumber !== null) {
    query = `
      query($orgLogin: String!, $projectNumber: Int!, $first: Int!) {
        organization(login: $orgLogin) {
          projectV2(number: $projectNumber) {
            id
            title
            items(first: $first) {
              nodes {
                id
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                      name
                    }
                  }
                }
                content {
                  ... on Issue {
                    id
                    number
                    title
                    url
                    state
                    body
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    milestone {
                      dueOn
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    variables = {
      orgLogin: orgName,
      projectNumber: parseInt(projectNumber, 10),
      first: 100,
    };
  } else if (projectId) {
    // Use direct project ID query
    query = `
      query($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            id
            title
            items(first: $first) {
              nodes {
                id
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                      name
                    }
                  }
                }
                content {
                  ... on Issue {
                    id
                    number
                    title
                    url
                    state
                    body
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    milestone {
                      dueOn
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    variables = {
      projectId: projectId,
      first: 100,
    };
  } else {
    throw new Error('Either project_id or org_name + project_number must be provided');
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub GraphQL API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  // Handle both organization-based and direct ID queries
  let project;
  if (orgName && projectNumber !== null) {
    project = result.data?.organization?.projectV2;
  } else {
    project = result.data?.node;
  }

  if (!project || !project.items) {
    throw new Error('Invalid project or project not found. Check organization name, project number, or project ID.');
  }

  // Extract issues from project items
  const issues = [];
  for (const item of project.items.nodes) {
    if (item.content) {
      // Check if content is an Issue (has number field which is unique to issues)
      if (item.content.number !== undefined) {
        const issue = item.content;
        
        // Find status field value from project item
        let statusFieldValue = null;
        if (item.fieldValues && item.fieldValues.nodes) {
          const statusField = item.fieldValues.nodes.find(
            (fv) => fv && fv.field && fv.field.name && 
            (fv.field.name.toLowerCase().includes('status') || 
             fv.field.name.toLowerCase().includes('state'))
          );
          if (statusField && statusField.name) {
            statusFieldValue = statusField.name;
          }
        }

        // Normalize GraphQL response to match REST API format for mapping function
        const normalizedIssue = {
          number: issue.number,
          title: issue.title,
          url: issue.url,
          html_url: issue.url, // GraphQL uses 'url', REST uses 'html_url'
          state: issue.state,
          body: issue.body,
          milestone: issue.milestone ? { due_on: issue.milestone.dueOn } : null,
          projectStatus: statusFieldValue,
          // Normalize labels: GraphQL returns { nodes: [...] }, REST returns [...]
          labels: issue.labels && issue.labels.nodes 
            ? issue.labels.nodes.map(l => ({ name: l.name }))
            : (issue.labels || []),
          // Normalize assignees: GraphQL returns { nodes: [...] }, REST returns single assignee
          assignee: issue.assignees && issue.assignees.nodes && issue.assignees.nodes.length > 0
            ? { login: issue.assignees.nodes[0].login }
            : null,
          assignees: issue.assignees, // Keep original for reference
        };

        issues.push(normalizedIssue);
      }
    }
  }

  return issues;
}

/**
 * Fetch project items with their IDs and issue numbers for updating
 */
async function fetchProjectItemsWithIds(projectId, token, orgName = null, projectNumber = null) {
  if (!token) {
    throw new Error('GitHub token is required for Project API access');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Conductor-App',
  };

  let query, variables;

  if (orgName && projectNumber !== null) {
    query = `
      query($orgLogin: String!, $projectNumber: Int!, $first: Int!) {
        organization(login: $orgLogin) {
          projectV2(number: $projectNumber) {
            id
            fields(first: 20) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
            items(first: $first) {
              nodes {
                id
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          id
                          name
                        }
                      }
                      name
                    }
                  }
                }
                content {
                  ... on Issue {
                    id
                    number
                  }
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      orgLogin: orgName,
      projectNumber: parseInt(projectNumber, 10),
      first: 100,
    };
  } else if (projectId) {
    query = `
      query($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            id
            fields(first: 20) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
            items(first: $first) {
              nodes {
                id
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          id
                          name
                        }
                      }
                      name
                    }
                  }
                }
                content {
                  ... on Issue {
                    id
                    number
                  }
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      projectId: projectId,
      first: 100,
    };
  } else {
    throw new Error('Either project_id or org_name + project_number must be provided');
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub GraphQL API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  let project;
  if (orgName && projectNumber !== null) {
    project = result.data?.organization?.projectV2;
  } else {
    project = result.data?.node;
  }

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

/**
 * Update a project item's status field value
 */
async function updateProjectItemStatus(projectId, itemId, statusFieldId, statusValue, token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Conductor-App',
  };

  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $value }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `;

  const variables = {
    projectId: projectId,
    itemId: itemId,
    fieldId: statusFieldId,
    value: statusValue,
  };

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub GraphQL mutation error: ${response.status} ${response.statusText} - ${text}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GitHub GraphQL mutation errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

/**
 * Create a GitHub issue from a task
 */
async function createGitHubIssue(owner, repo, token, task) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Conductor-App',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const body = {
    title: task.title || 'Task from Conductor',
    body: [
      'Created from Conductor task board.',
      '',
      `Status: ${task.group || 'todo'}`,
      `Assignee (Conductor): ${task.assignee || 'None'}`,
      `Due: ${task.due || 'TBD'}`,
    ].join('\n'),
  };

  // Optional: label from badge (low/medium/high)
  if (task.badge) {
    body.labels = [String(task.badge)];
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `GitHub issue create error: ${response.status} ${response.statusText} ${text}`,
    );
  }

  const data = await response.json();
  return data;
}

/**
 * Map a GitHub issue to our task format
 */
function mapGitHubIssueToTask(issue, members = []) {
  // Determine status bucket based on project status field, issue state, and labels
  let group = 'todo';
  
  // First, check if we have a project status field (from GitHub Projects)
  if (issue.projectStatus) {
    const status = issue.projectStatus.toLowerCase();
    if (status.includes('done') || status.includes('complete') || status.includes('closed')) {
      group = 'done';
    } else if (status.includes('progress') || status.includes('doing') || status.includes('in progress')) {
      group = 'progress';
    } else if (status.includes('todo') || status.includes('backlog') || status.includes('not started')) {
      group = 'todo';
    }
  }
  
  // Fall back to issue state and labels if no project status
  if (group === 'todo' && issue.state === 'closed') {
    group = 'done';
  } else if (group === 'todo' && issue.labels && issue.labels.some((label) => {
    const name = typeof label === 'string' ? label : (label.name || '').toLowerCase();
    return name.includes('in-progress') || name.includes('progress') || name.includes('doing');
  })) {
    group = 'progress';
  }

  // Default assignee is GitHub login or "None"
  let assignee = 'None';
  // Handle both REST API format (single assignee) and GraphQL format (assignees array)
  const assigneeData = issue.assignee || (issue.assignees && issue.assignees.nodes && issue.assignees.nodes[0]);
  if (assigneeData) {
    const login = assigneeData.login || assigneeData;
    assignee = login;

    // Try to map to a known member name if possible
    const matchedMember = members.find(
      (m) =>
        (m.name && m.name.toLowerCase().includes(login.toLowerCase())) ||
        (m.initials && m.initials.toLowerCase() === login.toLowerCase()),
    );
    if (matchedMember) {
      assignee = matchedMember.name;
    }
  }

  // Priority badge from labels (high/medium/low)
  let badge = 'medium';
  const labels = issue.labels || (issue.labels && issue.labels.nodes ? issue.labels.nodes : []);
  if (labels && labels.some((label) => {
    const name = typeof label === 'string' ? label : (label.name || '').toLowerCase();
    return name.includes('high');
  })) {
    badge = 'high';
  } else if (labels && labels.some((label) => {
    const name = typeof label === 'string' ? label : (label.name || '').toLowerCase();
    return name.includes('low');
  })) {
    badge = 'low';
  }

  // Due date from milestone if present
  let due = 'TBD';
  if (issue.milestone && (issue.milestone.due_on || issue.milestone.dueOn)) {
    const dueDate = new Date(issue.milestone.due_on || issue.milestone.dueOn);
    due = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return {
    title: issue.title,
    badge,
    due: issue.state === 'closed' ? 'Completed' : due,
    assignee,
    githubIssueNumber: issue.number,
    githubUrl: issue.html_url || issue.url,
    githubState: issue.state,
    group,
  };
}

module.exports = {
  fetchGitHubIssues,
  fetchGitHubProjectIssues,
  fetchProjectItemsWithIds,
  updateProjectItemStatus,
  createGitHubIssue,
  mapGitHubIssueToTask,
};

