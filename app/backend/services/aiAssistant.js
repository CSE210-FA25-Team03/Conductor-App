// backend/services/aiAssistant.js
// AI Assistant service using Google Gemini API

const classDirectoryDb = require('../db/classDirectory');
const teamsDb = require('../db/teams');
const teamCardDb = require('../db/teamCard');
const studentWeeklyDb = require('../db/studentWeekly');

/**
 * Get course context data for the AI to use when answering questions
 */
async function getCourseContext(courseId) {
    try {
        const [directory, teams] = await Promise.all([
            classDirectoryDb.getClassDirectory(courseId),
            teamsDb.getAllTeams(courseId)
        ]);

        // Fetch detailed team card info for each team (including members)
        const teamCards = await Promise.all(
            (teams || []).map(team => teamCardDb.getTeamCard(team.id, courseId))
        );

        // Count total students from team members
        const allStudents = new Set();
        teamCards.forEach(card => {
            if (card && card.members) {
                card.members.forEach(member => allStudents.add(member.id));
            }
        });

        const context = {
            course: directory.course || {},
            instructors: directory.instructors || [],
            TAs: directory.TAs || [],
            tutors: directory.tutors || [],
            teams: teams || [],
            teamCards: teamCards.filter(Boolean), // Detailed team info with members
            teamCount: teams?.length || 0,
            studentCount: allStudents.size,
            instructorCount: directory.instructors?.length || 0,
            taCount: directory.TAs?.length || 0,
            tutorCount: directory.tutors?.length || 0
        };

        return context;
    } catch (error) {
        console.error('Error fetching course context:', error);
        return {
            course: {},
            instructors: [],
            TAs: [],
            tutors: [],
            teams: [],
            teamCards: [],
            teamCount: 0,
            studentCount: 0,
            instructorCount: 0,
            taCount: 0,
            tutorCount: 0
        };
    }
}

/**
 * Get user-specific context including weekly evaluations
 */
async function getUserContext(courseId, userEmail) {
    if (!userEmail) return null;
    
    try {
        const weeklyEval = await studentWeeklyDb.getWeeklyEvaluation(courseId, userEmail);
        return weeklyEval;
    } catch (error) {
        console.error('Error fetching user context:', error);
        return null;
    }
}

/**
 * Build user-specific evaluation info for the prompt
 */
function buildUserEvaluationPrompt(userContext) {
    if (!userContext) return '';
    
    const { user, reports, notes, journals } = userContext;
    
    let evalPrompt = `\n\nCurrent User's Personal Information:
- Name: ${user?.name || 'Unknown'}
- Email: ${user?.email || 'Unknown'}`;

    // Weekly evaluation reports
    if (reports && reports.length > 0) {
        evalPrompt += `\n\nWeekly Evaluation Reports (${reports.length} total):`;
        reports.forEach((report, index) => {
            evalPrompt += `\n  Week ${report.weekLabel || index + 1}:
    - Status: ${report.status || 'Not specified'}
    - Mood: ${report.mood || 'Not specified'}
    - Notes: ${report.notes || 'No notes'}
    - Date: ${report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown'}`;
        });
    } else {
        evalPrompt += `\n\nWeekly Evaluation Reports: No evaluations recorded yet.`;
    }

    // Evaluation notes from staff
    if (notes && notes.length > 0) {
        evalPrompt += `\n\nFeedback Notes from Staff (${notes.length} total):`;
        notes.forEach((note, index) => {
            evalPrompt += `\n  Note ${index + 1}:
    - From: ${note.authorName || 'Staff'}
    - Message: ${note.message || note.text || 'No message'}
    - Sentiment: ${note.sentiment || 'Neutral'}`;
            if (note.technicalScore) evalPrompt += `\n    - Technical Score: ${note.technicalScore}/5`;
            if (note.teamworkScore) evalPrompt += `\n    - Teamwork Score: ${note.teamworkScore}/5`;
            if (note.independenceScore) evalPrompt += `\n    - Independence Score: ${note.independenceScore}/5`;
        });
    }

    // Work journals summary
    if (journals && journals.length > 0) {
        evalPrompt += `\n\nWork Journal Entries (${journals.length} recent):`;
        journals.slice(0, 5).forEach((journal, index) => {
            const repliesCount = journal.replies?.length || 0;
            evalPrompt += `\n  Entry ${index + 1} (${new Date(journal.createdAt).toLocaleDateString()}):
    - Content: ${(journal.content || '').substring(0, 100)}${journal.content?.length > 100 ? '...' : ''}
    - Self Sentiment: ${journal.sentimentSelf || 'Not specified'}
    - Team Sentiment: ${journal.sentimentTeam || 'Not specified'}
    - Replies: ${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}`;
        });
    }

    return evalPrompt;
}

/**
 * Build a system prompt with course context
 */
function buildSystemPrompt(courseContext) {
    const { course, instructors, TAs, tutors, teamCards, teamCount, studentCount, instructorCount, taCount, tutorCount } = courseContext;

    const instructorNames = instructors.map(i => i.name).filter(Boolean).join(', ') || 'Not available';
    const taNames = TAs.map(t => t.name).filter(Boolean).join(', ') || 'Not available';
    const tutorNames = tutors.map(t => t.name).filter(Boolean).join(', ') || 'Not available';
    
    // Build detailed team information including members
    const teamDetailsList = (teamCards || []).map(card => {
        if (!card) return '';
        const memberList = (card.members || []).map(m => {
            const leaderTag = m.isLeader ? ' (Team Lead)' : '';
            return `    - ${m.name || m.email}${leaderTag}`;
        }).join('\n');
        
        const taInfo = card.ta ? `  Assigned TA: ${card.ta.name || card.ta.email}` : '  Assigned TA: None';
        
        return `
Team: ${card.name || card.code || 'Unnamed Team'}
  Team Number: ${card.displayNumber || 'N/A'}
  Status: ${card.status || 'Unknown'}
  Description: ${card.description || 'No description'}
  Repository: ${card.repoUrl || 'Not set'}
${taInfo}
  Members (${card.members?.length || 0}):
${memberList || '    No members'}`;
    }).join('\n') || 'No team details available';

    return `You are an AI assistant for the Conductor course management application. You help professors and staff answer questions about their courses, teams, and students.

Current Course Information:
- Course: ${course.course_code || 'Unknown'} - ${course.title || 'Unknown'}
- Term: ${course.term_name || 'Unknown'}
- Description: ${course.description || 'Not available'}

Staff Information:
- Number of Instructors/Professors: ${instructorCount}
- Instructor names: ${instructorNames}
- Number of TAs: ${taCount}
- TA names: ${taNames}
- Number of Tutors: ${tutorCount}
- Tutor names: ${tutorNames}

Course Statistics:
- Total number of teams: ${teamCount}
- Total number of students: ${studentCount}

Detailed Team Information:
${teamDetailsList}

Instructions:
1. Answer questions about the course, teams, students, and staff based on the information provided above.
2. Be helpful, concise, and friendly.
3. If asked about a specific team, provide details including members, status, and assigned TA.
4. If asked about a specific student, try to identify which team they are on.
5. Format your responses in a clear, readable way. Use bullet points or numbered lists when appropriate.
6. Keep responses focused on course-related information.`;
}

/**
 * Call Google Gemini API
 */
async function callGeminiAPI(userMessage, courseContext, userContext = null) {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    // Build the full system prompt with course context and user-specific evaluation data
    let systemPrompt = buildSystemPrompt(courseContext);
    
    // Add user-specific evaluation info if available
    if (userContext) {
        systemPrompt += buildUserEvaluationPrompt(userContext);
        systemPrompt += `\n\nAdditional Instructions for Personal Queries:
7. When the user asks about "my evaluation", "my feedback", or "my progress", use their personal evaluation data above.
8. You can tell them how many weeks have evaluations, what their status was each week, and any feedback they received.
9. Be encouraging and supportive when discussing their evaluations.`;
    }

    // Use gemini-2.0-flash (current recommended model)
    const model = 'gemini-2.0-flash';

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: systemPrompt + '\n\nUser question: ' + userMessage }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        }
    );

    if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        
        // Provide user-friendly error messages
        if (response.status === 429) {
            throw new Error('AI service is temporarily busy. Please wait a moment and try again.');
        } else if (response.status === 403) {
            throw new Error('API key is invalid or has insufficient permissions.');
        }
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the response text from Gemini's response format
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
        throw new Error('No response from Gemini API');
    }

    return responseText;
}

/**
 * Main chat function - uses Gemini API
 * @param {string} userMessage - The user's question
 * @param {string} courseId - The course ID
 * @param {object} userInfo - Optional user info { email, role }
 */
async function chat(userMessage, courseId, userInfo = null) {
    // Get course context from database
    const courseContext = await getCourseContext(courseId);

    // Get user-specific context if user info is provided
    let userContext = null;
    if (userInfo && userInfo.email) {
        userContext = await getUserContext(courseId, userInfo.email);
    }

    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!geminiKey) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }

    return await callGeminiAPI(userMessage, courseContext, userContext);
}

module.exports = {
    chat,
    getCourseContext,
    getUserContext,
    buildSystemPrompt,
    buildUserEvaluationPrompt
};
