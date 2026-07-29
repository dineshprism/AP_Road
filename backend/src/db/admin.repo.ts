import pool from "../db.js";

/** Data-access layer for admin-facing submission queries. */

export interface SubmissionFilters {
  district?: string;
  year?: string;
  month?: string;
  date?: string;
}

export async function getSubmissionsFiltered(filters: SubmissionFilters) {
  const { district, year, month, date } = filters;

  let query = "SELECT * FROM accident_submissions WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 1;

  if (district && district !== "all") {
    query += ` AND district = $${paramIndex++}`;
    params.push(district);
  }

  if (date) {
    query += ` AND accident_date = $${paramIndex++}`;
    params.push(date);
  } else if (year) {
    const yearNum = parseInt(year, 10);
    if (month && month !== "all") {
      const monthNum = parseInt(month, 10);
      const startDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
      const endDate = monthNum === 12
        ? `${yearNum + 1}-01-01`
        : `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-01`;
      query += ` AND accident_date >= $${paramIndex++} AND accident_date < $${paramIndex++}`;
      params.push(startDate, endDate);
    } else {
      query += ` AND accident_date >= $${paramIndex++} AND accident_date < $${paramIndex++}`;
      params.push(`${yearNum}-01-01`, `${yearNum + 1}-01-01`);
    }
  }

  query += " ORDER BY accident_date DESC";

  const result = await pool.query(query, params);
  return result.rows;
}
