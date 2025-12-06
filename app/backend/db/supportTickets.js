// backend/db/supportTickets.js
const db = require('./index');

// id (PRIMARY KEY), creator_id (FOREIGN KEY), team_id (FOREIGN KEY), subject, description

async function createSupportTicket(supportTicketData) {
    const { creator_id, team_id, subject, description } = supportTicketData;
    const result = await db.query(
        'INSERT INTO support_tickets (creator_id, team_id, subject, description) VALUES ($1, $2, $3, $4) RETURNING *',
        [creator_id, team_id, subject, description]
    );
    return result.rows[0];
}

async function getSupportTickets(team_id, creator_id) {
    if (!team_id && !creator_id) {
        throw new Error('At least one of team_id or creator_id must be provided');
    }
    if (team_id && !creator_id) {
        const result = await db.query(
            'SELECT * FROM support_tickets WHERE team_id = $1',
            [team_id]
        );
        return result.rows;
    }
    if (!team_id && creator_id) {
        const result = await db.query(
            'SELECT * FROM support_tickets WHERE creator_id = $1',
            [creator_id]
        );
        return result.rows;
    }
    const result = await db.query(
        'SELECT * FROM support_tickets WHERE team_id = $1 AND creator_id = $2',
        [team_id, creator_id]
    );
    return result.rows;
}


async function updateSupportTicket(id, supportTicketData) {
    const { subject, description } = supportTicketData;
    const result = await db.query(
        'UPDATE support_tickets SET subject = $1, description = $2 WHERE id = $3 RETURNING *',
        [subject, description, id]
    );
    return result.rows[0] || null;
}

async function deleteSupportTicketById(id) {
    const result = await db.query(
        'DELETE FROM support_tickets WHERE id = $1 RETURNING *',
        [id]
    );
    return result.rows[0] || null;
}

module.exports = {
  createSupportTicket,
  getSupportTickets,
  updateSupportTicket,
  deleteSupportTicketById,
};
