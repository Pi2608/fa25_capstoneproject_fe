"use client";

import s from "../admin.module.css";

export default function AdminDashboard() {
  return (
    <div className={s.stack}>
      <section className={s.kpis}>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Total users</span></div>
          <div className={s.kpiNum}>12,584</div>
          <div className={s.kpiTrend}>+3.2%</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Active today</span></div>
          <div className={s.kpiNum}>1,204</div>
          <div className={s.kpiTrend}>+0.8%</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>New signups</span></div>
          <div className={s.kpiNum}>93</div>
          <div className={s.kpiTrend}>+6.1%</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Errors (24h)</span></div>
          <div className={s.kpiNum}>7</div>
          <div className={s.kpiTrend}>-12%</div>
        </div>
      </section>

      <section className={s.grid2}>
        <div className={s.panel}>
          <div className={s.panelHead}>
            <h3>Usage overview</h3>
            <div className={s.filters}>
              <select className={s.select}>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
          </div>
          <div className={s.chartPlaceholder}>Chart</div>
        </div>

        <div className={s.panel}>
          <div className={s.panelHead}><h3>Recent activity</h3></div>
          <ul className={s.activity}>
            <li><span className={s.dot} /><div><b>duy.ng</b> created a map layer</div><time>2m ago</time></li>
            <li><span className={s.dot} /><div><b>admin</b> updated plan Free</div><time>25m ago</time></li>
            <li><span className={s.dot} /><div><b>mai.ph</b> invited a member</div><time>1h ago</time></li>
            <li><span className={s.dot} /><div><b>system</b> nightly backup completed</div><time>4h ago</time></li>
          </ul>
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Top accounts</h3>
          <div className={s.filters}>
            <input className={s.input} placeholder="Search account…" />
          </div>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td>Nguyen Van A</td>
                  <td>user{i + 1}@imos.com</td>
                  <td>Member</td>
                  <td><span className={s.badgeSuccess}>Active</span></td>
                  <td>2025-09-10</td>
                  <td><button className={s.linkBtn}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={s.pagination}>
          <button className={s.pageBtn} disabled>Prev</button>
          <div className={s.pageDots}><b>1</b><span>2</span><span>3</span>…<span>12</span></div>
          <button className={s.pageBtn}>Next</button>
        </div>
      </section>
    </div>
  );
}
