const fs = require('fs');
const path = require('path');
const TeamsRepository = require('../TeamsRepository');
const PORT = process.env.PORT || 3000;
const { Pool } = require("pg");
require("dotenv").config();

app.use(express.json()); // Parse JSON bodies

// PostgreSQL / Supabase Session Pooler config
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

class TeamsRepositoryPostgres extends TeamsRepository {
    async getAllTeams() {
        const query = `SELECT * FROM teams;`;
        const result = await pool.query(query);
        return result.rows;  // PostgreSQL returns rows here
    }

    async getTeamById(id) {
        const query = `SELECT * FROM teams WHERE id = $1;`;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    async getTeamsByLeaderId(leaderId) {
        const query = `SELECT * FROM teams WHERE leader_id = $1;`;
        const result = await pool.query(query, [leaderId]);
        return result.rows;
    }

    async getTeamsByTaId(taId) {
        const query = `SELECT * FROM teams WHERE ta_id = $1;`;
        const result = await pool.query(query, [taId]);
        return result.rows;
    }

    async getTeamsForMembers(userId) {
        const query = `SELECT T.* FROM students S JOIN teams T ON S.team_id = T.id WHERE S.user_id = $1;`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    async getMembers(teamId) {
        const query = `SELECT user_id FROM students WHERE team_id = $1;`;
        const result = await pool.query(query, [teamId]);
        return result.rows;
    }


    async createTeam(teamData) {
        const query = `
            INSERT INTO teams(leader_id, ta_id, title, description, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [
            teamData.leader_id,
            teamData.ta_id,
            teamData.title,
            teamData.description,
            teamData.status
        ];

        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async updateTeam(id, teamData) {
        const query = `
            UPDATE teams
            SET leader_id = $1,
                ta_id = $2,
                title = $3,
                description = $4,
                status = $5
            WHERE id = $6
            RETURNING *;
        `;
        const values = [
            teamData.leader_id,
            teamData.ta_id,
            teamData.title,
            teamData.description,
            teamData.status,
            id
        ];

        const result = await this.pool.query(query, values);
        return result.rows[0] || null;
    }

    async deleteTeam(id) {
        const query = `DELETE FROM teams WHERE id = $1;`;
        const result = await this.pool.query(query, [id]);

        return result.rowCount > 0;
    }

    async getUserRole(userId) {
        const query = `SELECT role FROM users WHERE id = $1;`;
        const params = [userId];
        const result = await this.pool.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0].role;
    }

    async getTeamsByUserId(_uId) {
        role = await this.getUserRole(_uid);

        if (role === 'team_leader') {
            return this.getTeamsByLeaderId(_uid);
        } else if (role === 'ta') {
            return this.getTeamsByTaId(_uid);
        } else if (role === 'team_member') {
            return this.getTeamsForMembers(_uid);
        } else if (role === 'professor') {
            return this.getAllTeams();
        }

    }

}

module.exports = TeamsRepositoryPostgres;

