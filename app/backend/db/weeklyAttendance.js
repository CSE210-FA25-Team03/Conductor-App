// backend/db/weeklyAttendance.js
// Weekly attendance submission system with flexible 7-day periods

const db = require('./index');

/**
 * Calculate 7-day period from any date
 * Returns { startDate, endDate } where endDate is startDate + 6 days
 * Dates are returned as YYYY-MM-DD strings in local timezone
 */
function calculatePeriod(date) {
  const d = new Date(date);
  const startDate = new Date(d);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  
  // Format dates in local timezone (not UTC) to avoid timezone conversion issues
  function formatLocalDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return {
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate),
  };
}

/**
 * Generate period label from dates
 */
function generatePeriodLabel(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = start.toLocaleString('en-US', { month: 'short' });
  const endMonth = end.toLocaleString('en-US', { month: 'short' });
  
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}

/**
 * Check if update is within 2-day window after period end
 */
function canUpdate(periodEndDate) {
  const endDate = new Date(periodEndDate);
  const deadline = new Date(endDate);
  deadline.setDate(deadline.getDate() + 2);
  deadline.setHours(23, 59, 59, 999);
  
  return new Date() <= deadline;
}

/**
 * Calculate attendance rate for a user's submission
 * Returns rate (0-1) based on how many attendance types are true
 */
function calculateUserAttendanceRate(attendanceTypes) {
  if (!attendanceTypes || typeof attendanceTypes !== 'object') {
    return 0;
  }
  
  const types = Object.values(attendanceTypes);
  const attendedCount = types.filter(v => v === true).length;
  const totalTypes = types.length || 1; // Avoid division by zero
  
  return totalTypes > 0 ? attendedCount / totalTypes : 0;
}

/**
 * Submit or update weekly attendance
 */
async function submitWeeklyAttendance(courseId, userId, data) {
  if (!courseId || !userId) {
    throw new Error('Course ID and User ID are required');
  }

  const {
    periodStartDate,
    periodEndDate,
    periodLabel,
    attendanceTypes,
  } = data;

  // Validate period dates
  if (!periodStartDate || !periodEndDate) {
    throw new Error('Period start and end dates are required');
  }

  const startDate = new Date(periodStartDate);
  const endDate = new Date(periodEndDate);
  const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

  if (daysDiff !== 6) {
    throw new Error('Period must be exactly 7 days (start + 6 days = end)');
  }

  // Validate attendance types
  if (!attendanceTypes || typeof attendanceTypes !== 'object') {
    throw new Error('Attendance types must be an object');
  }

  // Check if submission exists
  const { rows: existingRows } = await db.query(
    `
    SELECT id, created_at, updated_at
    FROM weekly_attendance_submissions
    WHERE course_id = $1
      AND user_id = $2
      AND period_start_date = $3
    `,
    [courseId, userId, periodStartDate],
  );

  const isUpdate = existingRows.length > 0;
  const existingId = existingRows.length > 0 ? existingRows[0].id : null;

  // Check update window if this is an update
  if (isUpdate && !canUpdate(periodEndDate)) {
    throw new Error('Update window has expired. Updates are only allowed within 2 days after period end.');
  }

  // Generate label if not provided
  const label = periodLabel || generatePeriodLabel(periodStartDate, periodEndDate);

  let submissionId;
  let createdAt;
  let updatedAt;

  if (isUpdate) {
    // Update existing submission
    const { rows } = await db.query(
      `
      UPDATE weekly_attendance_submissions
      SET 
        attendance_types = $1,
        period_label = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, created_at, updated_at
      `,
      [JSON.stringify(attendanceTypes), label, existingId],
    );

    submissionId = rows[0].id;
    createdAt = rows[0].created_at;
    updatedAt = rows[0].updated_at;
  } else {
    // Create new submission
    const { rows } = await db.query(
      `
      INSERT INTO weekly_attendance_submissions (
        course_id,
        user_id,
        period_start_date,
        period_end_date,
        period_label,
        attendance_types
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at, updated_at
      `,
      [
        courseId,
        userId,
        periodStartDate,
        periodEndDate,
        label,
        JSON.stringify(attendanceTypes),
      ],
    );

    submissionId = rows[0].id;
    createdAt = rows[0].created_at;
    updatedAt = rows[0].updated_at;
  }

  // Calculate update deadline
  const deadline = new Date(periodEndDate);
  deadline.setDate(deadline.getDate() + 2);
  deadline.setHours(23, 59, 59, 999);

  // Notify team lead if this is an update
  let notificationSent = false;
  if (isUpdate) {
    try {
      await notifyTeamLeadOnUpdate(courseId, submissionId, userId, periodStartDate);
      notificationSent = true;
    } catch (err) {
      console.error('Failed to notify team lead:', err);
      // Don't fail the submission if notification fails
    }
  }

  return {
    id: submissionId,
    periodStartDate,
    periodEndDate,
    periodLabel: label,
    attendanceTypes,
    createdAt,
    updatedAt,
    isUpdate,
    updateDeadline: deadline.toISOString(),
    notificationSent,
  };
}

/**
 * Get user's weekly attendance submissions
 */
async function getUserWeeklyAttendance(courseId, userId, periodStartDate = null) {
  if (!courseId || !userId) {
    return { submissions: [] };
  }

  let query;
  let params;

  if (periodStartDate) {
    // Get specific period
    query = `
      SELECT 
        id,
        period_start_date,
        period_end_date,
        period_label,
        attendance_types,
        created_at,
        updated_at
      FROM weekly_attendance_submissions
      WHERE course_id = $1
        AND user_id = $2
        AND period_start_date = $3
      ORDER BY period_start_date DESC
    `;
    params = [courseId, userId, periodStartDate];
  } else {
    // Get all submissions
    query = `
      SELECT 
        id,
        period_start_date,
        period_end_date,
        period_label,
        attendance_types,
        created_at,
        updated_at
      FROM weekly_attendance_submissions
      WHERE course_id = $1
        AND user_id = $2
      ORDER BY period_start_date DESC
    `;
    params = [courseId, userId];
  }

  const { rows } = await db.query(query, params);

  const submissions = rows.map((row) => {
    const deadline = new Date(row.period_end_date);
    deadline.setDate(deadline.getDate() + 2);
    deadline.setHours(23, 59, 59, 999);

    return {
      id: row.id,
      periodStartDate: row.period_start_date,
      periodEndDate: row.period_end_date,
      periodLabel: row.period_label,
      attendanceTypes: row.attendance_types,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      canUpdate: canUpdate(row.period_end_date),
      updateDeadline: deadline.toISOString(),
    };
  });

  return { submissions };
}

/**
 * Get team attendance overview with time-series data
 */
async function getTeamAttendanceOverview(courseId, teamId, startDate = null, endDate = null) {
  if (!courseId || !teamId) {
    return null;
  }

  // Get team members
  const { rows: memberRows } = await db.query(
    `
    SELECT tm.user_id, u.display_name, u.email
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = $1
    `,
    [teamId],
  );

  if (memberRows.length === 0) {
    return null;
  }

  const memberIds = memberRows.map((m) => m.user_id);
  const memberMap = new Map(
    memberRows.map((m) => [m.user_id, { name: m.display_name, email: m.email }]),
  );

  // Get team info
  const { rows: teamRows } = await db.query(
    `
    SELECT id, name, code
    FROM teams
    WHERE id = $1 AND course_id = $2
    `,
    [teamId, courseId],
  );

  if (teamRows.length === 0) {
    return null;
  }

  const team = teamRows[0];

  // Build date filter
  let dateFilter = '';
  const params = [courseId, memberIds];
  let paramIndex = 3;

  if (startDate && endDate) {
    dateFilter = `AND period_start_date >= $${paramIndex} AND period_start_date <= $${paramIndex + 1}`;
    params.push(startDate, endDate);
  }

  // Get all submissions for team members
  const { rows: submissionRows } = await db.query(
    `
    SELECT 
      user_id,
      period_start_date,
      period_end_date,
      period_label,
      attendance_types
    FROM weekly_attendance_submissions
    WHERE course_id = $1
      AND user_id = ANY($2::uuid[])
      ${dateFilter}
    ORDER BY period_start_date ASC
    `,
    params,
  );

  // Group by period
  const periodMap = new Map();

  // Initialize periods for all members (including missing submissions = 0%)
  submissionRows.forEach((row) => {
    const periodKey = row.period_start_date;
    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, {
        periodStartDate: row.period_start_date,
        periodEndDate: row.period_end_date,
        periodLabel: row.period_label,
        memberRates: new Map(),
      });
    }

    const rate = calculateUserAttendanceRate(row.attendance_types);
    periodMap.get(periodKey).memberRates.set(row.user_id, rate);
  });

  // Calculate time-series data
  const timeSeries = Array.from(periodMap.values())
    .map((period) => {
      // Calculate rates for all members (missing = 0%)
      const rates = memberIds.map((memberId) => {
        return period.memberRates.get(memberId) || 0;
      });

      const totalMembers = memberIds.length;
      const attendanceRate =
        totalMembers > 0 ? rates.reduce((a, b) => a + b, 0) / totalMembers : 0;
      const attendedCount = rates.filter((r) => r > 0).length;

      // Calculate breakdown
      const breakdown = {
        class: 0,
        group_meeting: 0,
        office_hours: 0,
        class_meeting: 0,
      };

      submissionRows
        .filter(
          (s) =>
            s.period_start_date === period.periodStartDate &&
            period.memberRates.has(s.user_id),
        )
        .forEach((submission) => {
          const types = submission.attendance_types || {};
          if (types.class) breakdown.class++;
          if (types.group_meeting) breakdown.group_meeting++;
          if (types.office_hours) breakdown.office_hours++;
          if (types.class_meeting) breakdown.class_meeting++;
        });

      return {
        periodStartDate: period.periodStartDate,
        periodEndDate: period.periodEndDate,
        periodLabel: period.periodLabel,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        totalMembers,
        attendedCount,
        breakdown,
      };
    })
    .sort((a, b) => new Date(a.periodStartDate) - new Date(b.periodStartDate));

  // Calculate member details
  const memberDetails = memberIds.map((memberId) => {
    const member = memberMap.get(memberId);
    const memberSubmissions = submissionRows.filter((s) => s.user_id === memberId);
    const totalPeriods = timeSeries.length;
    const periodsAttended = memberSubmissions.filter((s) => {
      const rate = calculateUserAttendanceRate(s.attendance_types);
      return rate > 0;
    }).length;

    // Calculate average rate
    const rates = memberSubmissions.map((s) =>
      calculateUserAttendanceRate(s.attendance_types),
    );
    const avgRate =
      totalPeriods > 0
        ? (rates.reduce((a, b) => a + b, 0) + (totalPeriods - rates.length) * 0) /
          totalPeriods
        : 0;

    return {
      userId: memberId,
      name: member.name,
      email: member.email,
      attendanceRate: Math.round(avgRate * 100) / 100,
      periodsAttended,
      totalPeriods,
    };
  });

  // Calculate overview stats
  const totalPeriods = timeSeries.length;
  const avgRate =
    timeSeries.length > 0
      ? timeSeries.reduce((sum, p) => sum + p.attendanceRate, 0) / timeSeries.length
      : 0;
  const currentPeriodRate =
    timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].attendanceRate : 0;

  return {
    teamId: team.id,
    teamName: team.name,
    overview: {
      totalPeriods,
      averageAttendanceRate: Math.round(avgRate * 100) / 100,
      currentPeriodRate: Math.round(currentPeriodRate * 100) / 100,
    },
    timeSeries,
    memberDetails,
  };
}

/**
 * Get class attendance overview with time-series data
 */
async function getClassAttendanceOverview(courseId, startDate = null, endDate = null) {
  if (!courseId) {
    return null;
  }

  // Get all students in course
  const { rows: studentRows } = await db.query(
    `
    SELECT cm.user_id, u.display_name, u.email
    FROM course_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.course_id = $1
      AND cm.status = 'active'
    `,
    [courseId],
  );

  if (studentRows.length === 0) {
    return null;
  }

  const studentIds = studentRows.map((s) => s.user_id);

  // Build date filter
  let dateFilter = '';
  const params = [courseId, studentIds];
  let paramIndex = 3;

  if (startDate && endDate) {
    dateFilter = `AND period_start_date >= $${paramIndex} AND period_start_date <= $${paramIndex + 1}`;
    params.push(startDate, endDate);
  }

  // Get all submissions
  const { rows: submissionRows } = await db.query(
    `
    SELECT 
      user_id,
      period_start_date,
      period_end_date,
      period_label,
      attendance_types
    FROM weekly_attendance_submissions
    WHERE course_id = $1
      AND user_id = ANY($2::uuid[])
      ${dateFilter}
    ORDER BY period_start_date ASC
    `,
    params,
  );

  // Group by period
  const periodMap = new Map();

  submissionRows.forEach((row) => {
    const periodKey = row.period_start_date;
    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, {
        periodStartDate: row.period_start_date,
        periodEndDate: row.period_end_date,
        periodLabel: row.period_label,
        studentRates: new Map(),
      });
    }

    const rate = calculateUserAttendanceRate(row.attendance_types);
    periodMap.get(periodKey).studentRates.set(row.user_id, rate);
  });

  // Calculate time-series data
  const timeSeries = Array.from(periodMap.values())
    .map((period) => {
      // Calculate rates for all students (missing = 0%)
      const rates = studentIds.map((studentId) => {
        return period.studentRates.get(studentId) || 0;
      });

      const totalStudents = studentIds.length;
      const attendanceRate =
        totalStudents > 0 ? rates.reduce((a, b) => a + b, 0) / totalStudents : 0;
      const attendedCount = rates.filter((r) => r > 0).length;

      // Calculate breakdown
      const breakdown = {
        class: 0,
        group_meeting: 0,
        office_hours: 0,
        class_meeting: 0,
      };

      submissionRows
        .filter(
          (s) =>
            s.period_start_date === period.periodStartDate &&
            period.studentRates.has(s.user_id),
        )
        .forEach((submission) => {
          const types = submission.attendance_types || {};
          if (types.class) breakdown.class++;
          if (types.group_meeting) breakdown.group_meeting++;
          if (types.office_hours) breakdown.office_hours++;
          if (types.class_meeting) breakdown.class_meeting++;
        });

      return {
        periodStartDate: period.periodStartDate,
        periodEndDate: period.periodEndDate,
        periodLabel: period.periodLabel,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        totalStudents,
        attendedCount,
        breakdown,
      };
    })
    .sort((a, b) => new Date(a.periodStartDate) - new Date(b.periodStartDate));

  // Get team breakdown
  const { rows: teamRows } = await db.query(
    `
    SELECT 
      t.id,
      t.name,
      COUNT(tm.user_id) as member_count
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    WHERE t.course_id = $1
    GROUP BY t.id, t.name
    `,
    [courseId],
  );

  const teamBreakdown = await Promise.all(
    teamRows.map(async (team) => {
      const teamOverview = await getTeamAttendanceOverview(
        courseId,
        team.id,
        startDate,
        endDate,
      );
      return {
        teamId: team.id,
        teamName: team.name,
        attendanceRate: teamOverview
          ? teamOverview.overview.averageAttendanceRate
          : 0,
        memberCount: parseInt(team.member_count, 10),
      };
    }),
  );

  // Calculate overview stats
  const totalPeriods = timeSeries.length;
  const avgRate =
    timeSeries.length > 0
      ? timeSeries.reduce((sum, p) => sum + p.attendanceRate, 0) / timeSeries.length
      : 0;
  const currentPeriodRate =
    timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].attendanceRate : 0;

  return {
    overview: {
      totalStudents: studentIds.length,
      totalPeriods,
      averageAttendanceRate: Math.round(avgRate * 100) / 100,
      currentPeriodRate: Math.round(currentPeriodRate * 100) / 100,
    },
    timeSeries,
    teamBreakdown,
  };
}

/**
 * Notify team lead when student updates attendance
 */
async function notifyTeamLeadOnUpdate(courseId, submissionId, studentUserId, periodStartDate) {
  // Find student's team and team lead
  const { rows: teamRows } = await db.query(
    `
    SELECT 
      t.id as team_id,
      tm_lead.user_id as team_lead_id
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    JOIN team_members tm_lead ON tm_lead.team_id = t.id AND tm_lead.is_leader = true
    WHERE tm.user_id = $1
      AND t.course_id = $2
    LIMIT 1
    `,
    [studentUserId, courseId],
  );

  if (teamRows.length === 0) {
    // Student not in a team or no team lead
    return;
  }

  const { team_id, team_lead_id } = teamRows[0];

  // Check if notification already exists
  const { rows: existingRows } = await db.query(
    `
    SELECT id
    FROM attendance_update_notifications
    WHERE submission_id = $1 AND team_lead_user_id = $2
    `,
    [submissionId, team_lead_id],
  );

  if (existingRows.length > 0) {
    // Update existing notification
    await db.query(
      `
      UPDATE attendance_update_notifications
      SET notification_sent_at = NOW(), is_read = false, read_at = NULL
      WHERE id = $1
      `,
      [existingRows[0].id],
    );
  } else {
    // Create new notification
    await db.query(
      `
      INSERT INTO attendance_update_notifications (
        course_id,
        submission_id,
        student_user_id,
        team_lead_user_id,
        team_id,
        period_start_date
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [courseId, submissionId, studentUserId, team_lead_id, team_id, periodStartDate],
    );
  }
}

/**
 * Get team lead notifications
 */
async function getTeamLeadNotifications(courseId, teamLeadUserId) {
  if (!courseId || !teamLeadUserId) {
    return { notifications: [], unreadCount: 0 };
  }

  const { rows } = await db.query(
    `
    SELECT 
      n.id,
      n.submission_id,
      n.student_user_id,
      n.period_start_date,
      n.notification_sent_at,
      n.is_read,
      n.read_at,
      u.display_name as student_name,
      u.email as student_email,
      t.name as team_name
    FROM attendance_update_notifications n
    JOIN users u ON u.id = n.student_user_id
    LEFT JOIN teams t ON t.id = n.team_id
    WHERE n.course_id = $1
      AND n.team_lead_user_id = $2
    ORDER BY n.notification_sent_at DESC
    `,
    [courseId, teamLeadUserId],
  );

  // Get period info for each notification
  const notifications = await Promise.all(
    rows.map(async (row) => {
      const { rows: submissionRows } = await db.query(
        `
        SELECT period_start_date, period_end_date, period_label
        FROM weekly_attendance_submissions
        WHERE id = $1
        `,
        [row.submission_id],
      );

      const period = submissionRows[0] || {};

      return {
        id: row.id,
        studentName: row.student_name,
        studentEmail: row.student_email,
        teamName: row.team_name,
        periodStartDate: period.period_start_date,
        periodEndDate: period.period_end_date,
        periodLabel: period.period_label,
        updatedAt: row.notification_sent_at,
        notificationSentAt: row.notification_sent_at,
        isRead: row.is_read,
        submissionId: row.submission_id,
      };
    }),
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount };
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId, teamLeadUserId) {
  await db.query(
    `
    UPDATE attendance_update_notifications
    SET is_read = true, read_at = NOW()
    WHERE id = $1 AND team_lead_user_id = $2
    `,
    [notificationId, teamLeadUserId],
  );
}

module.exports = {
  calculatePeriod,
  generatePeriodLabel,
  canUpdate,
  calculateUserAttendanceRate,
  submitWeeklyAttendance,
  getUserWeeklyAttendance,
  getTeamAttendanceOverview,
  getClassAttendanceOverview,
  notifyTeamLeadOnUpdate,
  getTeamLeadNotifications,
  markNotificationAsRead,
};

