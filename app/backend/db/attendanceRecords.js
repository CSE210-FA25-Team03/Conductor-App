// backend/db/attendanceRecords.js
// Attendance records system - stores actual dates, calculates periods for visualization

const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

/**
 * Calculate 7-day period from any date
 * Periods are consecutive 7-day blocks: 1-7, 8-14, 15-21, 22-28, etc.
 * Returns { startDate, endDate } where endDate is startDate + 6 days
 */
function calculatePeriod(date) {
  const d = new Date(date);
  const dayOfMonth = d.getDate();
  
  // Calculate period start day: 1, 8, 15, 22, 29, etc.
  const periodStartDay = Math.floor((dayOfMonth - 1) / 7) * 7 + 1;
  
  const periodStart = new Date(d.getFullYear(), d.getMonth(), periodStartDay);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 6);
  
  // Format dates in local timezone
  function formatLocalDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return {
    startDate: formatLocalDate(periodStart),
    endDate: formatLocalDate(periodEnd),
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
 * Submit attendance records (with actual dates)
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @param {Object} data - { attendanceDates: { class: [dates], group_meeting: [dates], ... } }
 */
async function submitAttendanceRecords(courseId, userId, data) {
  if (!courseId || !userId) {
    throw new Error('Course ID and User ID are required');
  }

  const { attendanceDates } = data;
  
  if (!attendanceDates || typeof attendanceDates !== 'object') {
    throw new Error('attendanceDates object is required');
  }

  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const records = [];
    const allPeriods = new Set();
    
    // Process each attendance type
    for (const [attendanceType, dates] of Object.entries(attendanceDates)) {
      if (!Array.isArray(dates)) {
        continue;
      }
      
      // Validate attendance type
      const validTypes = ['class', 'group_meeting', 'office_hours', 'class_meeting'];
      if (!validTypes.includes(attendanceType)) {
        continue;
      }
      
      // Process each date
      for (const dateStr of dates) {
        if (!dateStr || typeof dateStr !== 'string') {
          continue;
        }
        
        // Validate date format (YYYY-MM-DD)
        const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
        if (!dateMatch) {
          throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
        }
        
        const attendanceDate = dateStr;
        const period = calculatePeriod(attendanceDate);
        allPeriods.add(period.startDate);
        
        // Insert or update record (using ON CONFLICT)
        const insertQuery = `
          INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type, updated_at)
          VALUES ($1, $2, $3, $4, now())
          ON CONFLICT (course_id, user_id, attendance_date, attendance_type)
          DO UPDATE SET updated_at = now()
          RETURNING id, attendance_date, attendance_type, created_at, updated_at
        `;
        
        const result = await client.query(insertQuery, [
          courseId,
          userId,
          attendanceDate,
          attendanceType,
        ]);
        
        records.push({
          id: result.rows[0].id,
          attendanceDate: result.rows[0].attendance_date,
          attendanceType: result.rows[0].attendance_type,
          calculatedPeriod: {
            startDate: period.startDate,
            endDate: period.endDate,
            label: generatePeriodLabel(period.startDate, period.endDate),
          },
        });
      }
    }
    
    // Check if any updates occurred (for notification)
    // Notification should be sent when student updates attendance (not just new submissions)
    let shouldNotify = false;
    if (records.length > 0) {
      // Check if this is an update (records exist for these periods that were created before this transaction)
      const periodStarts = Array.from(allPeriods);
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM attendance_records
        WHERE course_id = $1 AND user_id = $2
          AND get_period_start(attendance_date) = ANY($3::date[])
          AND created_at < now() - interval '1 minute'
      `;
      const checkResult = await client.query(checkQuery, [
        courseId,
        userId,
        periodStarts,
      ]);
      
      shouldNotify = parseInt(checkResult.rows[0].count) > 0;
    }
    
    await client.query('COMMIT');
    
    // Trigger team lead notification if this is an update
    // Per requirements: "When student updates the attendance, team lead should be notified"
    if (shouldNotify && records.length > 0) {
      // Get the most recent period
      const latestPeriod = Array.from(allPeriods).sort().pop();
      try {
        await notifyTeamLeadOnUpdate(courseId, userId, latestPeriod);
      } catch (err) {
        console.error('Failed to notify team lead:', err);
        // Don't fail the submission if notification fails
      }
    }
    
    return {
      success: true,
      recordsCreated: records.length,
      records,
      isUpdate: shouldNotify,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete attendance records (for a specific date range or all)
 * Used when user wants to remove attendance
 */
async function deleteAttendanceRecords(courseId, userId, dateRange = null) {
  if (!courseId || !userId) {
    throw new Error('Course ID and User ID are required');
  }

  let query = 'DELETE FROM attendance_records WHERE course_id = $1 AND user_id = $2';
  const params = [courseId, userId];
  
  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query += ' AND attendance_date >= $3 AND attendance_date <= $4';
    params.push(dateRange.startDate, dateRange.endDate);
  }
  
  const result = await db.query(query, params);
  return { deletedCount: result.rowCount };
}

/**
 * Get user's attendance records
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @param {string} startDate - Optional start date filter
 * @param {string} endDate - Optional end date filter
 */
async function getUserAttendanceRecords(courseId, userId, startDate = null, endDate = null) {
  if (!courseId || !userId) {
    throw new Error('Course ID and User ID are required');
  }

  let query = `
    SELECT 
      id,
      attendance_date,
      attendance_type,
      created_at,
      updated_at,
      get_period_start(attendance_date) as period_start_date,
      get_period_end(attendance_date) as period_end_date
    FROM attendance_records
    WHERE course_id = $1 AND user_id = $2
  `;
  
  const params = [courseId, userId];
  
  if (startDate) {
    query += ' AND attendance_date >= $' + (params.length + 1);
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND attendance_date <= $' + (params.length + 1);
    params.push(endDate);
  }
  
  query += ' ORDER BY attendance_date DESC, attendance_type';
  
  const result = await db.query(query, params);
  
  return result.rows.map(row => ({
    id: row.id,
    attendanceDate: row.attendance_date,
    attendanceType: row.attendance_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    period: {
      startDate: row.period_start_date,
      endDate: row.period_end_date,
      label: generatePeriodLabel(row.period_start_date, row.period_end_date),
    },
  }));
}

/**
 * Get team attendance overview (aggregated by period)
 */
async function getTeamAttendanceOverview(courseId, teamId, startDate = null, endDate = null) {
  if (!courseId || !teamId) {
    throw new Error('Course ID and Team ID are required');
  }

  // Get all team members
  const teamMembersQuery = `
    SELECT user_id FROM team_members WHERE team_id = $1
  `;
  const teamMembersResult = await db.query(teamMembersQuery, [teamId]);
  const teamMemberIds = teamMembersResult.rows.map(r => r.user_id);
  
  if (teamMemberIds.length === 0) {
    return {
      teamId,
      totalMembers: 0,
      periods: [],
      summary: {
        averageRate: 0,
        totalRecords: 0,
      },
    };
  }
  
  // Get attendance records for team members, grouped by period
  let query = `
    WITH period_data AS (
      SELECT 
        ar.user_id,
        get_period_start(ar.attendance_date) as period_start,
        get_period_end(ar.attendance_date) as period_end,
        ar.attendance_type,
        COUNT(*) as type_count
      FROM attendance_records ar
      WHERE ar.course_id = $1 
        AND ar.user_id = ANY($2::uuid[])
  `;
  
  const params = [courseId, teamMemberIds];
  
  if (startDate) {
    query += ' AND ar.attendance_date >= $' + (params.length + 1);
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND ar.attendance_date <= $' + (params.length + 1);
    params.push(endDate);
  }
  
  query += `
      GROUP BY ar.user_id, get_period_start(ar.attendance_date), get_period_end(ar.attendance_date), ar.attendance_type
    ),
    period_summary AS (
      SELECT 
        period_start,
        period_end,
        COUNT(DISTINCT user_id) as users_with_records,
        COUNT(*) as total_type_records,
        COUNT(DISTINCT attendance_type) as unique_types
      FROM period_data
      GROUP BY period_start, period_end
    )
    SELECT 
      ps.period_start,
      ps.period_end,
      ps.users_with_records,
      ps.total_type_records,
      ps.unique_types,
      $3::int as total_team_members
    FROM period_summary ps
    ORDER BY ps.period_start ASC
  `;
  
  params.push(teamMemberIds.length);
  
  const result = await db.query(query, params);
  
  // Calculate rates per period
  const periods = result.rows.map(row => {
    const periodStart = row.period_start;
    const periodEnd = row.period_end;
    
    // For each period, calculate attendance rate
    // Rate = (unique attendance types recorded) / (4 possible types)
    const expectedTypes = 4; // class, group_meeting, office_hours, class_meeting
    const rate = row.unique_types / expectedTypes;
    
    return {
      periodStart,
      periodEnd,
      label: generatePeriodLabel(periodStart, periodEnd),
      usersWithRecords: parseInt(row.users_with_records),
      totalTeamMembers: parseInt(row.total_team_members),
      attendanceRate: Math.round(rate * 100) / 100,
      totalRecords: parseInt(row.total_type_records),
    };
  });
  
  // Calculate overall summary
  const totalRecords = periods.reduce((sum, p) => sum + p.totalRecords, 0);
  const avgRate = periods.length > 0
    ? periods.reduce((sum, p) => sum + p.attendanceRate, 0) / periods.length
    : 0;
  
  return {
    teamId,
    totalMembers: teamMemberIds.length,
    periods,
    summary: {
      averageRate: Math.round(avgRate * 100) / 100,
      totalRecords,
    },
  };
}

/**
 * Get class attendance overview (aggregated by period)
 */
async function getClassAttendanceOverview(courseId, startDate = null, endDate = null) {
  if (!courseId) {
    throw new Error('Course ID is required');
  }

  // Get all students in the course (users with 'student' role assignment)
  const studentsQuery = `
    SELECT DISTINCT u.id 
    FROM users u
    INNER JOIN course_memberships cm ON u.id = cm.user_id
    INNER JOIN role_assignments ra ON ra.user_id = u.id
    INNER JOIN roles r ON r.id = ra.role_id
    WHERE cm.course_id = $1 
      AND cm.status = 'active'
      AND ra.scope_type = 'course'
      AND ra.scope_id = $1
      AND r.key = 'student'
  `;
  const studentsResult = await db.query(studentsQuery, [courseId]);
  const studentIds = studentsResult.rows.map(r => r.id);
  
  if (studentIds.length === 0) {
    return {
      totalStudents: 0,
      periods: [],
      summary: {
        averageRate: 0,
        totalRecords: 0,
      },
    };
  }
  
  // Similar to team overview but for all students
  let query = `
    WITH period_data AS (
      SELECT 
        ar.user_id,
        get_period_start(ar.attendance_date) as period_start,
        get_period_end(ar.attendance_date) as period_end,
        ar.attendance_type,
        COUNT(*) as type_count
      FROM attendance_records ar
      WHERE ar.course_id = $1 
        AND ar.user_id = ANY($2::uuid[])
  `;
  
  const params = [courseId, studentIds];
  
  if (startDate) {
    query += ' AND ar.attendance_date >= $' + (params.length + 1);
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND ar.attendance_date <= $' + (params.length + 1);
    params.push(endDate);
  }
  
  query += `
      GROUP BY ar.user_id, get_period_start(ar.attendance_date), get_period_end(ar.attendance_date), ar.attendance_type
    ),
    period_summary AS (
      SELECT 
        period_start,
        period_end,
        COUNT(DISTINCT user_id) as users_with_records,
        COUNT(*) as total_type_records,
        COUNT(DISTINCT attendance_type) as unique_types
      FROM period_data
      GROUP BY period_start, period_end
    )
    SELECT 
      ps.period_start,
      ps.period_end,
      ps.users_with_records,
      ps.total_type_records,
      ps.unique_types,
      $3::int as total_students
    FROM period_summary ps
    ORDER BY ps.period_start ASC
  `;
  
  params.push(studentIds.length);
  
  const result = await db.query(query, params);
  
  const periods = result.rows.map(row => {
    const periodStart = row.period_start;
    const periodEnd = row.period_end;
    
    const expectedTypes = 4;
    const rate = row.unique_types / expectedTypes;
    
    return {
      periodStart,
      periodEnd,
      label: generatePeriodLabel(periodStart, periodEnd),
      usersWithRecords: parseInt(row.users_with_records),
      totalStudents: parseInt(row.total_students),
      attendanceRate: Math.round(rate * 100) / 100,
      totalRecords: parseInt(row.total_type_records),
    };
  });
  
  const totalRecords = periods.reduce((sum, p) => sum + p.totalRecords, 0);
  const avgRate = periods.length > 0
    ? periods.reduce((sum, p) => sum + p.attendanceRate, 0) / periods.length
    : 0;
  
  return {
    totalStudents: studentIds.length,
    periods,
    summary: {
      averageRate: Math.round(avgRate * 100) / 100,
      totalRecords,
    },
  };
}

/**
 * Notify team lead when student updates attendance
 */
async function notifyTeamLeadOnUpdate(courseId, studentUserId, periodStartDate) {
  // Find team where student is member, then find team lead (using is_leader flag)
  const teamQuery = `
    SELECT tm.team_id, tlm.user_id as team_lead_id
    FROM team_members tm
    INNER JOIN teams t ON tm.team_id = t.id
    INNER JOIN team_members tlm ON tlm.team_id = tm.team_id
    WHERE tm.user_id = $1 
      AND tlm.is_leader = true
      AND t.course_id = $2
    LIMIT 1
  `;
  
  const teamResult = await db.query(teamQuery, [studentUserId, courseId]);
  
  if (teamResult.rows.length === 0) {
    return; // No team or team lead found
  }
  
  const { team_id, team_lead_id } = teamResult.rows[0];
  
  // Check if notification already exists
  const checkQuery = `
    SELECT id FROM attendance_update_notifications
    WHERE course_id = $1 
      AND student_user_id = $2
      AND team_lead_user_id = $3
      AND period_start_date = $4
      AND is_read = false
  `;
  
  const checkResult = await db.query(checkQuery, [
    courseId,
    studentUserId,
    team_lead_id,
    periodStartDate,
  ]);
  
  if (checkResult.rows.length > 0) {
    // Update existing notification to mark as unread
    await db.query(
      `
      UPDATE attendance_update_notifications
      SET notification_sent_at = now(),
          is_read = false,
          read_at = NULL
      WHERE id = $1
      `,
      [checkResult.rows[0].id],
    );
    return;
  }
  
  // Create new notification (submission_id is nullable for new system)
  const insertQuery = `
    INSERT INTO attendance_update_notifications (
      course_id, student_user_id, team_lead_user_id, team_id, period_start_date, submission_id
    )
    VALUES ($1, $2, $3, $4, $5, NULL)
    RETURNING id
  `;
  
  await db.query(insertQuery, [
    courseId,
    studentUserId,
    team_lead_id,
    team_id,
    periodStartDate,
  ]);
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

  // Calculate period info for each notification
  const notifications = rows.map((row) => {
    const periodStart = row.period_start_date;
    // Calculate period end (start + 6 days)
    const periodEndDate = new Date(periodStart);
    periodEndDate.setDate(periodEndDate.getDate() + 6);
    
    // Format period end date as YYYY-MM-DD
    const year = periodEndDate.getFullYear();
    const month = String(periodEndDate.getMonth() + 1).padStart(2, '0');
    const day = String(periodEndDate.getDate()).padStart(2, '0');
    const periodEndStr = `${year}-${month}-${day}`;
    
    const periodLabel = generatePeriodLabel(periodStart, periodEndStr);

    return {
      id: row.id,
      studentName: row.student_name,
      studentEmail: row.student_email,
      teamName: row.team_name,
      periodStartDate: periodStart,
      periodEndDate: periodEndStr,
      periodLabel: periodLabel,
      updatedAt: row.notification_sent_at,
      notificationSentAt: row.notification_sent_at,
      isRead: row.is_read,
    };
  });

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
  submitAttendanceRecords,
  deleteAttendanceRecords,
  getUserAttendanceRecords,
  getTeamAttendanceOverview,
  getClassAttendanceOverview,
  notifyTeamLeadOnUpdate,
  getTeamLeadNotifications,
  markNotificationAsRead,
};

