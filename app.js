// --- ตัวแปรหลัก ---
var currentUser = null; // ใช้ผู้ใช้จริงจาก Firestore
var appId = "budget-manage-v001";
var tableState = { page: 1, limit: 10, currentType: 'budget_types', fullData: [], searchQuery: '' };
var analysisState = { page: 1, limit: 10, fullData: [], searchQuery: '' };
var adminTableState = {}; // state ต่อ 1 ตารางในหน้า ผู้ดูแลระบบ > ตั้งต้นข้อมูล

document.addEventListener('DOMContentLoaded', async () => {
    // แก้ไขระบบลูกตารหัสผ่าน
    const toggleBtn = document.getElementById('toggle-password');
    const passInput = document.getElementById('login-password');
    if (toggleBtn && passInput) {
        toggleBtn.onclick = function(e) {
            e.preventDefault();
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            this.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="w-5 h-5"></i>`;
            lucide.createIcons();
        };
    }

    // วันที่และ Login logic
    const dateTxt = document.getElementById('current-date-txt');
    if (dateTxt) dateTxt.innerText = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = (e) => { e.preventDefault(); handleLogin(); };
    lucide.createIcons();
});

async function handleLogin() {
    const uEl = document.getElementById('login-username');
    const pEl = document.getElementById('login-password');
    const username = (uEl?.value || '').trim();
    const password = (pEl?.value || '').trim();

    if (!username || !password) return alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

    // กันกดรัว
    const submitBtn = document.querySelector('#login-form button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        // อ่านผู้ใช้จริงจาก Firestore (ไม่ใช้ Mockup)
        const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
        const snap = await col.where('username', '==', username).where('password', '==', password).limit(1).get();

        if (snap.empty) {
            alert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            return;
        }

        const doc = snap.docs[0];
        const data = doc.data() || {};

        currentUser = {
            id: doc.id,
            username,
            name: data.fullname || data.name || username,
            role: data.role || 'staff_dept',
            dept: data.dept || data.org || ''
        };

        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('u-name-display').innerText = currentUser.name;
        document.getElementById('u-dept-display').innerText = currentUser.dept;
        App.navigate('dashboard');
    } catch (err) {
        console.error(err);
        alert('เข้าสู่ระบบไม่สำเร็จ: กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}


const App = {
    navigate(pageId) {
        const view = document.getElementById('content-view');
        const title = document.getElementById('page-title');
        UI.renderSidebar(pageId, currentUser.role);
        switch(pageId) {
            case 'dashboard': title.innerText = "1. Dashboard"; view.innerHTML = UI.dashboardPage(); break;
            case 'manage':
                title.innerText = "2. จัดการข้อมูลครุภัณฑ์";
                view.innerHTML = UI.managePage();
                // init เฉพาะ (ง.4)
                this.initManageForm4();
                break;
            case 'admin': title.innerText = "3. ผู้ดูแลระบบ"; view.innerHTML = UI.adminPage(); this.loadAdminAllTables(); this.fillUserDeptSelect(); this.initAdminSetup(); break;
        }
        lucide.createIcons();
    },

    switchSubTab(page, subId) {
        const view = document.getElementById('content-view');
        if (page === 'admin') {
            view.innerHTML = UI.adminPage(subId);
            if (subId === 'tab1') { this.loadAdminAllTables(); this.initAdminSetup(); }
            if (subId === 'tab2') { this.loadUserTable(); this.fillUserDeptSelect(); }
        } else if (page === 'manage') {
            view.innerHTML = UI.managePage(subId);
            if (subId === 'tab1') this.initManageForm4();
            if (subId === 'tab2') this.initManageForm5();
            if (subId === 'tab3') this.initManageForm6();
        }
        lucide.createIcons();
    },

    // =========================
    // (ง.4) Init + Dropdowns
    // =========================
    async initManageForm4() {
        if (!document.getElementById('f-dept')) return;

        // ── setOptions: ใช้ replaceWith(clone) แทน innerHTML
        //    เพื่อไม่ให้ browser fire onchange ขณะ populate ──────────────
        const setOptions = (sel, items, placeholder = 'โปรดระบุ ...') => {
            if (!sel) return;
            const clone = sel.cloneNode(false);        // copy element ไม่มี children
            clone.onchange = sel.onchange;             // คืน handler เดิม
            const empty = document.createElement('option');
            empty.value = '';
            empty.textContent = items.length ? placeholder : '— ยังไม่มีข้อมูล —';
            clone.appendChild(empty);
            for (const x of items) {
                const opt = document.createElement('option');
                opt.value = (x.value ?? x.id ?? '').toString();
                opt.textContent = (x.label ?? x.name ?? x.value ?? '').toString();
                clone.appendChild(opt);
            }
            clone.disabled = items.length === 0;
            // placeholder tint
            const syncTint = () => clone.value
                ? clone.classList.remove('f4-placeholder')
                : clone.classList.add('f4-placeholder');
            clone.addEventListener('change', syncTint);
            syncTint();
            sel.replaceWith(clone);                    // swap — ไม่ trigger event
        };

        // ── resetBelow: ล้างชั้นล่างทั้งหมดพร้อมกัน ป้องกันค่าเก่าค้าง ──
        const resetBelow = (...ids) => {
            for (const id of ids) {
                const s = document.getElementById(id);
                if (!s) continue;
                const cl = s.cloneNode(false);
                cl.onchange = s.onchange;
                const o = document.createElement('option');
                o.value = '';
                o.textContent = '— เลือกข้อมูลด้านบนก่อน —';
                cl.appendChild(o);
                cl.disabled = true;
                cl.classList.add('f4-placeholder');
                s.replaceWith(cl);
            }
        };

        const getCol = (name) => db.collection('artifacts').doc(appId)
            .collection('public').doc('data').collection(name);

        try {
            this.showLoader();

            const [depts, branches, budgetSources, items, categories,
                   plans, issues, strategies, dimensions, subStrategies, kpis, units, years, stratLinks] = await Promise.all([
                getCol('depts').orderBy('name').get(),
                getCol('branches').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('budget_types').orderBy('name').get().catch(() => ({ docs: [] })), // แหล่งเงินงบประมาณ → ดึงจาก budget_types
                getCol('items').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('categories').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_plans').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_issues').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_strategies').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_dimensions').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_sub_strategies').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_kpis').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('units').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('years').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_links').get().catch(() => ({ docs: [] }))
            ]);

            const mapDocs = (snap) => (snap?.docs || []).map(d => ({ id: d.id, ...d.data() }));
            const allKpis = mapDocs(kpis);

            const cache = this._f4cache = {
                depts:         mapDocs(depts),
                branches:      mapDocs(branches),
                budgetSources: mapDocs(budgetSources), // ข้อมูลจาก budget_types
                items:         mapDocs(items),
                categories:    mapDocs(categories),
                plans:         mapDocs(plans),
                issues:        mapDocs(issues),
                strategies:    mapDocs(strategies),
                dimensions:    mapDocs(dimensions),
                subStrategies: mapDocs(subStrategies),
                kpiDims:       allKpis.filter(k => k.type === 'dimension'),
                kpis:          allKpis.filter(k => k.type === 'kpi'),
                units:         mapDocs(units),
                years:         mapDocs(years),
                stratLinks:    mapDocs(stratLinks),
                _mergedDims:   [],
            };

            // ── mergeDuplicatesByName: deduplicate ด้วย name
            //    ชื่อซ้ำ → เหลือ 1 option แต่รวม id ทั้งหมดไว้ใน _allIds
            //    ทำให้ชั้น kpi filter ได้ครบแม้มิติถูกผูกหลาย doc ──────────
            const mergeDuplicatesByName = (list) => {
                const map = new Map();
                for (const x of list) {
                    const key = (x.name || '').trim();
                    if (!map.has(key)) map.set(key, { ...x, _allIds: [x.id] });
                    else map.get(key)._allIds.push(x.id);
                }
                return [...map.values()];
            };

            // populate dropdowns ที่ไม่ต้อง cascade
            setOptions(document.getElementById('f-dept'),          cache.depts);
            // สาขา/งาน: รีเซ็ตรอให้ผู้ใช้เลือก dept ก่อน
            const f4BranchEl = document.getElementById('f-branch');
            if (f4BranchEl) f4BranchEl.innerHTML = '<option value="">— เลือกหน่วยงานก่อน —</option>';
            setOptions(document.getElementById('f-budget-source'), cache.budgetSources);
            setOptions(document.getElementById('f-item'),          cache.items);
            setOptions(document.getElementById('f-category'),      cache.categories);
            setOptions(document.getElementById('f-year'),          cache.years);

            // ── populate Step 1 (แผนพัฒนา) — ดึงเฉพาะแผนที่มีใน strat_links และ active ──
            const planSel = document.getElementById('f-plan');
            if (planSel) {
                // deduplicate planId จาก strat_links เฉพาะ plan ที่ active
                const activePlanIds = new Set(
                    (cache.plans || []).filter(p => p.active !== false).map(p => p.id)
                );
                const seenPlan = new Set();
                const plansFromLinks = (cache.stratLinks || []).filter(l => {
                    if (l.planId && activePlanIds.has(l.planId) && !seenPlan.has(l.planId)) {
                        seenPlan.add(l.planId); return true;
                    }
                    return false;
                }).map(l => ({ id: l.planId, name: l.planName || l.planId }));
                // fallback: ถ้า strat_links ยังไม่มีข้อมูล ใช้ plans ที่ active
                const activePlans = (cache.plans || []).filter(p => p.active !== false);
                const planOpts = this.f4SortByName(plansFromLinks.length ? plansFromLinks : activePlans);
                planSel.innerHTML = '<option value="">— เลือกฉบับแผน —</option>' +
                    planOpts.map(p => `<option value="${p.id}">${p.name||p.label||p.id}</option>`).join('');
                planSel.disabled = false;
                planSel.classList.remove('f4-placeholder');
            }

            // ── init multi-row containers (Step 4,5,7) ให้เริ่มต้นว่างเปล่า ──
            if (!this._f4MultiOptions) this._f4MultiOptions = { dimension: [], substrategy: [], kpi: [] };
            ['dimension','substrategy','kpi'].forEach(step => {
                const container = document.getElementById(step === 'kpi' ? 'f-kpi-multi-rows' : `f-${step}-rows`);
                if (container && !container.children.length) {
                    this.f4RenderMultiRows(step, [], '— เลือกขั้นตอนด้านบนก่อน —');
                }
            });

            // ── ข้อ 13: หน่วยนับ (populate ทุก select หน่วยนับในส่วนมาตรฐานขั้นต่ำ) ──
            ['f-min-std-unit','f-have-total-unit','f-have-ok-unit','f-have-broken-unit'].forEach(uid => {
                setOptions(document.getElementById(uid), cache.units);
            });

            // init table KPI rows
            const body = document.getElementById('f-kpi-rows');
            if (body && !body.children.length) this.form4AddKpiRow();

            ['f-budget-other','f-item-desc','f-building-name','f-building-year','f-need','f-objective2']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el && !el.placeholder) el.placeholder = 'โปรดระบุ ...';
                });

        } catch (e) {
            console.error('initManageForm4 error', e);
        } finally {
            this.hideLoader();
        }
        // โหลดตารางรายการที่บันทึกแล้ว
        try { await this.loadForm4Records(); } catch(e) { console.warn('loadForm4Records init error', e); }
        // populate unit dropdowns ในแถวเริ่มต้น
        this.f4SubItemRefreshUnits();
    },

    form4AddKpiRow() {
        const tbody = document.getElementById('f-kpi-rows');
        if (!tbody) return;
        const rowId = `f4-kpi-row-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        tbody.insertAdjacentHTML('beforeend', `
            <tr id="${rowId}">
                <td class="px-4 py-3 text-center">
                    <input type="checkbox" class="f4-kpi-check w-4 h-4 align-middle">
                </td>
                <td class="px-4 py-3">
                    <select class="input-flat w-full f4-kpi-select"></select>
                </td>
                <td class="px-4 py-3">
                    <select class="input-flat w-full f4-unit-select"></select>
                </td>
                <td class="px-4 py-3">
                    <input class="input-flat w-full" placeholder="โปรดระบุ ..." />
                </td>
            </tr>
        `);
        this.form4SyncKpiRows();
        lucide.createIcons();
    },

    // ลบแถว KPI: ถ้าเลือก checkbox ไว้ -> ลบแถวที่เลือก, ถ้าไม่เลือก -> ลบแถวสุดท้าย (แต่ต้องเหลืออย่างน้อย 1)
    form4RemoveKpiRows() {
        const tbody = document.getElementById('f-kpi-rows');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (!rows.length) return;

        const checked = rows.filter(r => r.querySelector('input.f4-kpi-check')?.checked);
        const toRemove = checked.length ? checked : [rows[rows.length - 1]];

        // กันลบหมด
        if (rows.length - toRemove.length < 1) {
            // ลบให้เหลือ 1 แถว
            rows.slice(0, -1).forEach(r => r.remove());
        } else {
            toRemove.forEach(r => r.remove());
        }
    },

    form4SyncKpiRows() {
        const cache = this._f4cache;
        const tbody = document.getElementById('f-kpi-rows');
        if (!cache || !tbody) return;

        // ดึง kpiDimId จาก f-kpidim (step 6)
        const kpiDimId = document.getElementById('f-kpidim')?.value || '';
        const kpiItems = kpiDimId
            ? (cache.kpis || []).filter(k => (k.bscId||k.dimId||k.parentId||'') === kpiDimId)
            : (cache.kpis || []);

        const kpiHtml = `<option value="">โปรดระบุ ...</option>` +
            kpiItems.map(k => `<option value="${(k.id||'').replace(/"/g,'&quot;')}">${(k.name || k.label || '-').toString()}</option>`).join('');
        const unitHtml = `<option value="">โปรดระบุ ...</option>` +
            (cache.units || []).map(u => `<option value="${(u.name||u.id||'').replace(/"/g,'&quot;')}">${u.name||'-'}</option>`).join('');

        tbody.querySelectorAll('select.f4-kpi-select').forEach(sel => {
            const prev = sel.value;
            sel.innerHTML = kpiHtml;
            if (prev) sel.value = prev; // คงค่าที่เลือกไว้ก่อน (ถ้ายังมีอยู่)
            if (!sel.value) sel.classList.add('f4-placeholder');
            sel.onchange = () => sel.value ? sel.classList.remove('f4-placeholder') : sel.classList.add('f4-placeholder');
        });
        tbody.querySelectorAll('select.f4-unit-select').forEach(sel => {
            const prev = sel.value;
            sel.innerHTML = unitHtml;
            if (prev) sel.value = prev;
            if (!sel.value) sel.classList.add('f4-placeholder');
            sel.onchange = () => sel.value ? sel.classList.remove('f4-placeholder') : sel.classList.add('f4-placeholder');
        });
    },

    // --- Repair table (คงเดิม) ---
    form4AddRepairRow() {
        const tbody = document.getElementById('f-repair-body');
        if (!tbody) return;
        const rowIdx = tbody.children.length + 1;
        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td class="px-4 py-3"><input class="input-flat w-full bg-white" placeholder="โปรดระบุ ..."></td>
                <td class="px-4 py-3"><input class="input-flat w-full bg-white" placeholder="โปรดระบุ ..."></td>
                <td class="px-4 py-3"><input class="input-flat w-full bg-white" placeholder="โปรดระบุ ..."></td>
                <td class="px-4 py-3"><input class="input-flat w-full bg-white" placeholder="โปรดระบุ ..."></td>
                <td class="px-4 py-3"><input class="input-flat w-full bg-white" placeholder="โปรดระบุ ..."></td>
            </tr>
        `);
    },

    resetForm4() {
        const ids = [
            'f-dept','f-year','f-branch','f-budget-source','f-budget-other',
            'f-item','f-item-desc','f-category','f-building-name','f-building-year','f-building-note',
            'f-plan','f-issue','f-strategy','f-kpidim',
            'f-need','f-objective2',
            'f-min-std','f-min-std-unit','f-have-total','f-have-total-unit',
            'f-have-ok','f-have-ok-unit','f-have-broken','f-have-broken-unit'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'SELECT') el.value = '';
            else el.value = '';
        });
        // เคลียร์ KPI rows เหลือ 1 แถว
        const kpiBody = document.getElementById('f-kpi-rows');
        if (kpiBody) {
            kpiBody.innerHTML = '';
            this.form4AddKpiRow();
        }
        // เคลียร์ Repair rows ตั้งต้น 2 แถว
        const rep = document.getElementById('f-repair-body');
        if (rep) {
            rep.innerHTML = '';
            this.form4AddRepairRow();
            this.form4AddRepairRow();
        }
        // reset placeholder tint
        document.querySelectorAll('select').forEach(s => {
            if (!s.value) s.classList.add('f4-placeholder');
        });
        // reset cascade: ล็อก step 2,3,6 ใหม่ (select เดี่ยว)
        ['f-issue','f-strategy','f-kpidim'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = true;
            el.innerHTML = `<option value="">— เลือกขั้นตอนด้านบนก่อน —</option>`;
            el.classList.add('f4-placeholder');
        });
        // reset cascade: ล็อก step 4,5,7 ใหม่ (multi-row)
        ['dimension','substrategy','kpi'].forEach(step => {
            this._f4MultiOptions[step] = [];
            this.f4RenderMultiRows(step, [], '— เลือกขั้นตอนด้านบนก่อน —');
        });
    },

    // ── Cascade Step handler ──────────────────────────────────────────
    // ดึงข้อมูลจาก strat_links (ตารางที่ 2 หน้าผู้ดูแลระบบ) เพื่อ filter cascade
    // Step 1,2,3,6 = เลือกได้ 1 คำตอบ (select เดี่ยว)
    // Step 4,5,7   = เลือกได้หลายคำตอบ (multi-row select, เพิ่ม/ลบแถวได้)
    // step: 'plan' | 'issue' | 'strategy' | 'dimension' | 'substrategy' | 'kpidim'

    // เก็บ options ปัจจุบันของ multi-row แต่ละ step (สำหรับ re-render เวลาเพิ่ม/ลบแถว)
    _f4MultiOptions: { dimension: [], substrategy: [], kpi: [] },

    // ── Natural sort: เรียงตามเลขนำหน้าในชื่อ เช่น "1.1, 1.4, 1.5, 1.10" ──
    // รองรับชื่อแบบ "กลยุทธ์ย่อยที่ 1.1 Common Knowledge..." โดยดึงเลขทั้งหมดในชื่อ
    // มาเทียบเป็นชุด (1,1) (1,4) (1,5) (1,10) ทีละตำแหน่งแบบตัวเลขจริง ไม่ใช่ string
    f4NaturalCompare(a, b) {
        const nameA = (a.name || a.id || '').toString();
        const nameB = (b.name || b.id || '').toString();
        const numsA = nameA.match(/\d+(\.\d+)*/g) || [];
        const numsB = nameB.match(/\d+(\.\d+)*/g) || [];
        const partsA = (numsA[0] || '').split('.').map(Number);
        const partsB = (numsB[0] || '').split('.').map(Number);
        const len = Math.max(partsA.length, partsB.length);
        for (let i = 0; i < len; i++) {
            const x = partsA[i] === undefined ? -1 : partsA[i];
            const y = partsB[i] === undefined ? -1 : partsB[i];
            if (x !== y) return x - y;
        }
        // ถ้าเลขนำหน้าเท่ากันหมด (หรือไม่มีเลขเลยทั้งคู่) ให้ fallback เรียงตามชื่อแบบ locale compare
        return nameA.localeCompare(nameB, 'th');
    },

    f4LoadBranches() {
        const deptEl = document.getElementById('f-dept');
        const branchEl = document.getElementById('f-branch');
        if (!deptEl || !branchEl) return;
        const deptId = deptEl.value;
        if (!deptId) {
            branchEl.innerHTML = '<option value="">— เลือกหน่วยงานก่อน —</option>';
            return;
        }
        const branches = (this._f4cache?.branches || []).filter(b => b.deptId === deptId);
        branchEl.innerHTML = `<option value="">${branches.length ? '— เลือกสาขา/งาน —' : '— ไม่มีสาขา/งานในหน่วยงานนี้ —'}</option>` +
            branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    },

    f4SortByName(items) {
        return [...items].sort((a, b) => this.f4NaturalCompare(a, b));
    },

    fromLinks(links, filterFn, idField, nameField) {
        const seen = new Set();
        const result = [];
        for (const lnk of links) {
            if (filterFn(lnk) && lnk[idField] && !seen.has(lnk[idField])) {
                seen.add(lnk[idField]);
                result.push({ id: lnk[idField], name: lnk[nameField] || lnk[idField] });
            }
        }
        // เรียงตามเลขนำหน้าในชื่อ (natural sort) ไม่ใช่ตามวันที่บันทึก
        return this.f4SortByName(result);
    },

    // อ่านค่าทั้งหมดที่เลือกไว้ในแถวของ multi-row container (array of ids ที่ไม่ว่าง)
    f4GetMultiValues(step) {
        const containerId = step === 'kpi' ? 'f-kpi-multi-rows' : `f-${step}-rows`;
        const container = document.getElementById(containerId);
        if (!container) return [];
        // KPI step: ใช้ class f4-kpi-full-select แทน
        if (step === 'kpi') {
            return Array.from(container.querySelectorAll('.f4-kpi-full-select'))
                .map(s => s.value).filter(Boolean);
        }
        return Array.from(container.querySelectorAll('select'))
            .map(s => s.value).filter(Boolean);
    },

    // วาด select ใหม่ทุกแถวของ multi-row container ตาม options ที่กำหนด คงค่าที่เลือกไว้เดิมถ้ายังมีอยู่ใน options ใหม่
    f4RenderMultiRows(step, options, placeholder, onChangeStep) {
        const containerId = step === 'kpi' ? 'f-kpi-multi-rows' : `f-${step}-rows`;
        const container = document.getElementById(containerId);
        if (!container) return;

        this._f4MultiOptions[step] = options || [];

        // KPI step: render แบบใหม่ (select + หน่วยนับ + จำนวน)
        if (step === 'kpi') {
            this.f4RenderKpiFullRows(options, placeholder);
            return;
        }

        const prevValues = this.f4GetMultiValues(step);
        const hasData = (options || []).length > 0;

        const buildOptionsHtml = (selectedVal) => {
            let html = `<option value="">${hasData ? placeholder : '— ไม่มีข้อมูล —'}</option>`;
            (options || []).forEach(o => {
                const sel = o.id === selectedVal ? 'selected' : '';
                html += `<option value="${o.id}" ${sel}>${o.name}</option>`;
            });
            return html;
        };

        // ถ้ายังไม่มีแถวเลย หรือค่าที่เลือกไว้ทั้งหมดไม่อยู่ใน options ใหม่ ให้เริ่มจาก 1 แถวเปล่า
        let keepValues = prevValues.filter(v => (options || []).some(o => o.id === v));
        if (!keepValues.length) keepValues = [''];

        container.innerHTML = keepValues.map(v => `
            <select class="f4-strat-select f4-multi-select" data-step="${step}" ${hasData ? '' : 'disabled'}
                onchange="App.f4OnMultiChange('${step}', '${onChangeStep || ''}')">
                ${buildOptionsHtml(v)}
            </select>
        `).join('');

        container.querySelectorAll('select').forEach(s => {
            if (!s.value) s.classList.add('f4-placeholder'); else s.classList.remove('f4-placeholder');
        });
    },

    // Render KPI rows แบบใหม่: select KPI + select หน่วยนับ + input จำนวน
    f4RenderKpiFullRows(options, placeholder) {
        const container = document.getElementById('f-kpi-multi-rows');
        if (!container) return;
        const hasData = (options || []).length > 0;
        const cache = this._f4cache;
        const units = (cache?.units || []);
        const buildKpiOpts = (selectedVal = '') => {
            let h = `<option value="">${hasData ? (placeholder || '— เลือกตัวชี้วัด —') : '— ไม่มีข้อมูล —'}</option>`;
            (options || []).forEach(o => {
                h += `<option value="${o.id}" ${o.id === selectedVal ? 'selected' : ''}>${o.name}</option>`;
            });
            return h;
        };
        const buildUnitOpts = () => {
            let h = '<option value="">— หน่วยนับ —</option>';
            units.forEach(u => { h += `<option value="${u.id}">${u.name}</option>`; });
            return h;
        };
        const makeRow = (kpiVal = '', unitVal = '', amountVal = '') => `
            <div class="flex gap-2 items-center f4-kpi-full-row">
                <select class="f4-strat-select f4-kpi-full-select flex-1 ${kpiVal ? '' : 'f4-placeholder'}" ${hasData ? '' : 'disabled'}>
                    ${buildKpiOpts(kpiVal)}
                </select>
                <select class="input-flat w-32 text-xs f4-kpi-full-unit">
                    ${buildUnitOpts()}
                </select>
                <input type="number" class="input-flat w-24 text-xs f4-kpi-full-amount" placeholder="จำนวน" value="${amountVal}">
            </div>
        `;
        // ถ้ายังไม่มีแถวให้ใส่ 1 แถวเปล่า
        if (!container.children.length || container.querySelectorAll('.f4-kpi-full-row').length === 0) {
            container.innerHTML = makeRow();
        } else {
            // อัปเดต select options ทุกแถวโดยคง value เดิมไว้
            container.querySelectorAll('.f4-kpi-full-row').forEach(row => {
                const sel = row.querySelector('.f4-kpi-full-select');
                const prevVal = sel?.value || '';
                if (sel) {
                    sel.innerHTML = buildKpiOpts(prevVal);
                    sel.disabled = !hasData;
                    if (!sel.value) sel.classList.add('f4-placeholder'); else sel.classList.remove('f4-placeholder');
                }
                const unitSel = row.querySelector('.f4-kpi-full-unit');
                if (unitSel && !unitSel.options.length) unitSel.innerHTML = buildUnitOpts();
            });
        }
        // sync select style
        container.querySelectorAll('.f4-kpi-full-select').forEach(s => {
            s.onchange = () => { s.value ? s.classList.remove('f4-placeholder') : s.classList.add('f4-placeholder'); };
        });
    },

    f4AddKpiFullRow() {
        const container = document.getElementById('f-kpi-multi-rows');
        if (!container) return;
        const options = this._f4MultiOptions['kpi'] || [];
        if (!options.length) return alert('ยังไม่มีตัวชี้วัดให้เลือก กรุณาเลือกขั้นตอนก่อนหน้าให้ครบก่อน');
        const cache = this._f4cache;
        const units = (cache?.units || []);
        let kpiHtml = `<option value="">— เลือกตัวชี้วัด —</option>` + options.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        let unitHtml = `<option value="">— หน่วยนับ —</option>` + units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center f4-kpi-full-row';
        div.innerHTML = `
            <select class="f4-strat-select f4-kpi-full-select flex-1 f4-placeholder">${kpiHtml}</select>
            <select class="input-flat w-32 text-xs f4-kpi-full-unit">${unitHtml}</select>
            <input type="number" class="input-flat w-24 text-xs f4-kpi-full-amount" placeholder="จำนวน">
        `;
        div.querySelector('.f4-kpi-full-select').onchange = function() {
            this.value ? this.classList.remove('f4-placeholder') : this.classList.add('f4-placeholder');
        };
        container.appendChild(div);
    },

    f4RemoveKpiFullRow() {
        const container = document.getElementById('f-kpi-multi-rows');
        if (!container) return;
        const rows = container.querySelectorAll('.f4-kpi-full-row');
        if (rows.length <= 1) {
            const sel = rows[0]?.querySelector('.f4-kpi-full-select');
            const unit = rows[0]?.querySelector('.f4-kpi-full-unit');
            const amt = rows[0]?.querySelector('.f4-kpi-full-amount');
            if (sel) { sel.value = ''; sel.classList.add('f4-placeholder'); }
            if (unit) unit.value = '';
            if (amt) amt.value = '';
        } else {
            rows[rows.length - 1].remove();
        }
    },

    // เพิ่มแถวใหม่ใน multi-row container (ใช้ options ที่ cache ไว้ล่าสุด)
    f4AddMultiRow(step) {
        const containerId = step === 'kpi' ? 'f-kpi-multi-rows' : `f-${step}-rows`;
        const container = document.getElementById(containerId);
        if (!container) return;
        const options = this._f4MultiOptions[step] || [];
        const hasData = options.length > 0;
        if (!hasData) return alert('ยังไม่มีข้อมูลให้เลือกเพิ่ม กรุณาเลือกขั้นตอนก่อนหน้าให้ครบก่อน');

        const onChangeStep = step === 'dimension' ? 'dimension' : (step === 'substrategy' ? 'substrategy' : '');
        const sel = document.createElement('select');
        sel.className = 'f4-strat-select f4-multi-select f4-placeholder';
        sel.dataset.step = step;
        sel.setAttribute('onchange', `App.f4OnMultiChange('${step}','${onChangeStep}')`);
        sel.innerHTML = `<option value="">เลือก...</option>` + options.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        container.appendChild(sel);
        lucide.createIcons();
    },

    // ลบแถวสุดท้าย (กันลบหมด เหลืออย่างน้อย 1 แถว) แล้ว trigger cascade ต่อ
    f4RemoveMultiRow(step) {
        const containerId = step === 'kpi' ? 'f-kpi-multi-rows' : `f-${step}-rows`;
        const container = document.getElementById(containerId);
        if (!container) return;
        const rows = container.querySelectorAll('select');
        if (rows.length <= 1) {
            rows[0] && (rows[0].value = '');
        } else {
            rows[rows.length - 1].remove();
        }
        // re-trigger cascade ขั้นต่อไปจาก step นี้
        if (step === 'dimension') this.f4CascadeStep('dimension');
        else if (step === 'substrategy') this.f4CascadeStep('substrategy');
    },

    // เมื่อมีการเปลี่ยนค่าใน select ของ multi-row (step 4 หรือ 5) ให้ trigger cascade ต่อ
    f4OnMultiChange(step, onChangeStep) {
        document.querySelectorAll(`#${step === 'kpi' ? 'f-kpi-multi-rows' : `f-${step}-rows`} select`).forEach(s => {
            if (!s.value) s.classList.add('f4-placeholder'); else s.classList.remove('f4-placeholder');
        });
        if (onChangeStep) this.f4CascadeStep(onChangeStep);
    },

    f4CascadeStep(step) {
        const cache = this._f4cache;
        if (!cache) return;

        const links = cache.stratLinks || [];
        const val  = id => document.getElementById(id)?.value || '';
        const lock = (id, placeholder) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = true;
            el.innerHTML = `<option value="">${placeholder}</option>`;
            el.classList.add('f4-placeholder');
        };
        const fill = (id, items, placeholder) => {
            const el = document.getElementById(id);
            if (!el) return;
            const seen = new Set();
            const uniq = items.filter(x => x.id && !seen.has(x.id) && seen.add(x.id));
            el.disabled = uniq.length === 0;
            el.innerHTML = `<option value="">${uniq.length ? placeholder : '— ไม่มีข้อมูล —'}</option>` +
                uniq.map(x => `<option value="${x.id}">${x.name||x.label||x.id}</option>`).join('');
            if (!el.value) el.classList.add('f4-placeholder');
            el.addEventListener('change', () => el.value ? el.classList.remove('f4-placeholder') : el.classList.add('f4-placeholder'));
        };
        const fromLinks = (filterFn, idField, nameField) => this.fromLinks(links, filterFn, idField, nameField);
        const strictOrRelax = (strictFn, relaxFn, idField, nameField) => {
            const strict = fromLinks(strictFn, idField, nameField);
            if (strict.length) return strict;
            return fromLinks(relaxFn, idField, nameField);
        };
        const lockMulti = (step2) => this.f4RenderMultiRows(step2, [], '— เลือกขั้นตอนก่อนหน้า —');

        if (step === 'plan') {
            const planId = val('f-plan');
            const issues = planId
                ? fromLinks(l => l.planId === planId, 'issueId', 'issueName')
                : [];
            fill('f-issue', issues, '— เลือกประเด็นยุทธศาสตร์ —');
            lock('f-strategy', '— เลือกประเด็นก่อน —');
            lockMulti('dimension');
            lockMulti('substrategy');
            lock('f-kpidim', '— เลือกกลยุทธ์ก่อน —');
            lockMulti('kpi');
        }
        else if (step === 'issue') {
            const planId  = val('f-plan');
            const issueId = val('f-issue');
            const strats = issueId
                ? strictOrRelax(
                    l => l.planId === planId && l.issueId === issueId,
                    l => l.issueId === issueId,
                    'strategyId', 'strategyName')
                : [];
            fill('f-strategy', strats, '— เลือกวัตถุประสงค์เชิงยุทธศาสตร์ —');
            lockMulti('dimension');
            lockMulti('substrategy');
            lock('f-kpidim', '— เลือกกลยุทธ์ก่อน —');
            lockMulti('kpi');
        }
        else if (step === 'strategy') {
            const planId     = val('f-plan');
            const issueId    = val('f-issue');
            const strategyId = val('f-strategy');
            const dims = strategyId
                ? strictOrRelax(
                    l => l.planId === planId && l.issueId === issueId && l.strategyId === strategyId,
                    l => l.issueId === issueId && l.strategyId === strategyId,
                    'dimId', 'dimName')
                : [];
            // Step 4: กลยุทธ์ (multi-row)
            this.f4RenderMultiRows('dimension', dims, '— เลือกกลยุทธ์ —', 'dimension');
            lockMulti('substrategy');
            lock('f-kpidim', '— เลือกกลยุทธ์ก่อน —');
            lockMulti('kpi');
        }
        else if (step === 'dimension') {
            const planId      = val('f-plan');
            const issueId     = val('f-issue');
            const strategyId  = val('f-strategy');
            const dimIds      = this.f4GetMultiValues('dimension'); // หลายอันที่เลือกใน Step 4

            // Step 5: กลยุทธ์ย่อย — รวมข้อมูลจากทุกกลยุทธ์ (dimId) ที่เลือกไว้
            let subs = [];
            if (dimIds.length) {
                dimIds.forEach(dimId => {
                    const found = strictOrRelax(
                        l => l.planId === planId && l.issueId === issueId && l.strategyId === strategyId && l.dimId === dimId,
                        l => l.strategyId === strategyId && l.dimId === dimId,
                        'subId', 'subName');
                    subs = subs.concat(found);
                });
                // dedupe + เรียงตามเลขนำหน้า
                const seen = new Set();
                subs = this.f4SortByName(subs.filter(x => !seen.has(x.id) && seen.add(x.id)));
            }
            this.f4RenderMultiRows('substrategy', subs, '— เลือกกลยุทธ์ย่อย (ถ้ามี) —', 'substrategy');

            // Step 6: มิติ — รวมข้อมูลจากทุกกลยุทธ์ (dimId) ที่เลือกไว้ (select เดี่ยว)
            let kpiDims = [];
            if (dimIds.length) {
                dimIds.forEach(dimId => {
                    const found = strictOrRelax(
                        l => l.planId === planId && l.issueId === issueId && l.strategyId === strategyId && l.dimId === dimId,
                        l => l.strategyId === strategyId && l.dimId === dimId,
                        'kpiDimId', 'kpiDimName');
                    kpiDims = kpiDims.concat(found);
                });
                const seen2 = new Set();
                kpiDims = this.f4SortByName(kpiDims.filter(x => !seen2.has(x.id) && seen2.add(x.id)));
            }
            fill('f-kpidim', kpiDims, '— เลือกมิติ —');
            lockMulti('kpi');
        }
        else if (step === 'substrategy') {
            const planId     = val('f-plan');
            const issueId    = val('f-issue');
            const strategyId = val('f-strategy');
            const dimIds     = this.f4GetMultiValues('dimension');
            const subIds     = this.f4GetMultiValues('substrategy');

            if (subIds.length && dimIds.length) {
                // filter มิติให้แคบลงตาม dimId + subId ที่เลือกไว้ (รวมทุกคู่ที่เป็นไปได้)
                let kpiDims = [];
                dimIds.forEach(dimId => {
                    subIds.forEach(subId => {
                        const found = strictOrRelax(
                            l => l.planId === planId && l.issueId === issueId && l.strategyId === strategyId && l.dimId === dimId && l.subId === subId,
                            l => l.dimId === dimId && l.subId === subId,
                            'kpiDimId', 'kpiDimName');
                        kpiDims = kpiDims.concat(found);
                    });
                });
                const seen = new Set();
                kpiDims = this.f4SortByName(kpiDims.filter(x => !seen.has(x.id) && seen.add(x.id)));
                fill('f-kpidim', kpiDims, '— เลือกมิติ —');
                lockMulti('kpi');
            }
        }
        else if (step === 'kpidim') {
            const planId     = val('f-plan');
            const issueId    = val('f-issue');
            const strategyId = val('f-strategy');
            const dimIds     = this.f4GetMultiValues('dimension');
            const kpiDimId   = val('f-kpidim');

            // Step 7: ตัวชี้วัด (multi-row) — รวมจากทุก dimId ที่เลือกไว้ + kpiDimId ที่เลือก
            let kpis = [];
            if (kpiDimId && dimIds.length) {
                dimIds.forEach(dimId => {
                    const found = strictOrRelax(
                        l => l.planId === planId && l.issueId === issueId && l.strategyId === strategyId && l.dimId === dimId && l.kpiDimId === kpiDimId,
                        l => l.dimId === dimId && l.kpiDimId === kpiDimId,
                        'kpiId', 'kpiName');
                    kpis = kpis.concat(found);
                });
                const seen = new Set();
                kpis = this.f4SortByName(kpis.filter(x => !seen.has(x.id) && seen.add(x.id)));
            } else if (kpiDimId && !dimIds.length) {
                kpis = fromLinks(l => l.kpiDimId === kpiDimId, 'kpiId', 'kpiName');
            }
            this.f4RenderMultiRows('kpi', kpis, '— เลือกตัวชี้วัด —');
            this.form4SyncKpiRows();
        }
    },

    async saveForm4() {
        try {
            // บันทึกแบบง่าย: เก็บค่าที่กรอกไว้ใน Firestore (ไม่กระทบส่วนอื่น)
            const payload = {
                dept: document.getElementById('f-dept')?.value || '',
                year: document.getElementById('f-year')?.value || '',
                branch: document.getElementById('f-branch')?.value || '',
                budgetSource: document.getElementById('f-budget-source')?.value || '',
                budgetOther: document.getElementById('f-budget-other')?.value || '',
                item: document.getElementById('f-item')?.value || '',
                itemDesc: document.getElementById('f-item-desc')?.value || '',
                category: document.getElementById('f-category')?.value || '',
                buildingName: document.getElementById('f-building-name')?.value || '',
                buildingYear: document.getElementById('f-building-year')?.value || '',
                plan: document.getElementById('f-plan')?.value || '',
                planName: document.getElementById('f-plan')?.selectedOptions?.[0]?.text || '',
                issue: document.getElementById('f-issue')?.value || '',
                issueName: document.getElementById('f-issue')?.selectedOptions?.[0]?.text || '',
                strategy: document.getElementById('f-strategy')?.value || '',
                strategyName: document.getElementById('f-strategy')?.selectedOptions?.[0]?.text || '',
                // กลยุทธ์ (Step 4) — เลือกได้หลายอัน
                dimensions: Array.from(document.querySelectorAll('#f-dimension-rows select')).filter(s => s.value).map(s => ({
                    id: s.value, name: s.selectedOptions?.[0]?.text || ''
                })),
                // เก็บ field เดิมไว้เพื่อความเข้ากันได้ (ใช้อันแรกที่เลือก)
                dimension: document.querySelector('#f-dimension-rows select')?.value || '',
                dimensionName: document.querySelector('#f-dimension-rows select')?.selectedOptions?.[0]?.text || '',
                // กลยุทธ์ย่อย (Step 5) — เลือกได้หลายอัน
                substrategies: Array.from(document.querySelectorAll('#f-substrategy-rows select')).filter(s => s.value).map(s => ({
                    id: s.value, name: s.selectedOptions?.[0]?.text || ''
                })),
                substrategy: document.querySelector('#f-substrategy-rows select')?.value || '',
                substrategyName: document.querySelector('#f-substrategy-rows select')?.selectedOptions?.[0]?.text || '',
                kpiDim: document.getElementById('f-kpidim')?.value || '',
                kpiDimName: document.getElementById('f-kpidim')?.selectedOptions?.[0]?.text || '',
                // ตัวชี้วัด (Step 7) — KPI full rows (select + หน่วยนับ + จำนวน)
                kpiMains: Array.from(document.querySelectorAll('#f-kpi-multi-rows .f4-kpi-full-row')).map(row => ({
                    id: row.querySelector('.f4-kpi-full-select')?.value || '',
                    name: row.querySelector('.f4-kpi-full-select')?.selectedOptions?.[0]?.text || '',
                    unit: row.querySelector('.f4-kpi-full-unit')?.value || '',
                    unitName: row.querySelector('.f4-kpi-full-unit')?.selectedOptions?.[0]?.text || '',
                    amount: row.querySelector('.f4-kpi-full-amount')?.value || ''
                })).filter(r => r.id),
                kpiMain: document.querySelector('#f-kpi-multi-rows .f4-kpi-full-select')?.value || '',
                kpiMainName: document.querySelector('#f-kpi-multi-rows .f4-kpi-full-select')?.selectedOptions?.[0]?.text || '',
                need: document.getElementById('f-need')?.value || '',
                objective: document.getElementById('f-objective2')?.value || '',
                // รายการย่อย (ชื่อรายการ + หน่วยนับ + จำนวน + ราคา/ชิ้น)
                subItems: Array.from(document.querySelectorAll('#f4-sub-item-rows .f4-sub-item-row')).map(row => ({
                    name:  row.querySelector('.f4si-name')?.value  || '',
                    unit:  row.querySelector('.f4si-unit')?.value  || '',
                    qty:   row.querySelector('.f4si-qty')?.value   || '',
                    price: row.querySelector('.f4si-price')?.value || ''
                })).filter(r => r.name || r.qty || r.price),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser?.username || ''
            };

            this.showLoader();
            const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('form4');
            const id = document.getElementById('f4-edit-id')?.value || '';
            if (id) await col.doc(id).set(payload, { merge: true });
            else {
                const ref = await col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                const hid = document.getElementById('f4-edit-id');
                if (hid) hid.value = ref.id;
            }
            alert('บันทึกเรียบร้อย');
            await this.loadForm4Records();
        } catch (e) {
            console.error('saveForm4 error', e);
            alert('บันทึกไม่สำเร็จ');
        } finally {
            this.hideLoader();
        }
    },

    // ══════════════════════════════════════════════════════════════
    // FORM 4 (ง.4) — Sub-Items Table (ชื่อรายการย่อย)
    // ══════════════════════════════════════════════════════════════

    f4SubItemMakeRow(name='', unit='', qty='', price='') {
        const units = this._f4cache?.units || [];
        const unitOpts = '<option value="">หน่วยนับ</option>' + units.map(u => `<option value="${u.id}" ${u.id===unit||u.name===unit?'selected':''}>${u.name}</option>`).join('');
        const sub = (parseFloat(qty||0)*parseFloat(price||0)).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
        const div = document.createElement('div');
        div.className = 'f4-sub-item-row grid gap-2 items-center';
        div.style.gridTemplateColumns = '1fr 72px 88px 96px 96px';
        div.innerHTML = `
            <input class="f4si-name input-flat text-xs" placeholder="ชื่อรายการ..." value="${name}">
            <input class="f4si-qty input-flat text-xs text-center" type="number" placeholder="0" value="${qty}">
            <select class="f4si-unit input-flat text-xs">${unitOpts}</select>
            <input class="f4si-price input-flat text-xs text-right" type="number" placeholder="0.00" value="${price}">
            <span class="f4si-subtotal text-xs font-bold text-indigo-700 text-right pr-1">${sub}</span>
        `;
        div.querySelector('.f4si-qty').addEventListener('input', () => App.f4SubItemCalc());
        div.querySelector('.f4si-price').addEventListener('input', () => App.f4SubItemCalc());
        return div;
    },

    f4SubItemRefreshUnits() {
        const units = this._f4cache?.units || [];
        const optHtml = '<option value="">หน่วยนับ</option>' + units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        document.querySelectorAll('#f4-sub-item-rows .f4si-unit').forEach(sel => {
            const prev = sel.value;
            sel.innerHTML = optHtml;
            if (prev) sel.value = prev;
        });
    },

    f4SubItemAdd() {
        const container = document.getElementById('f4-sub-item-rows');
        if (!container) return;
        const row = this.f4SubItemMakeRow();
        container.appendChild(row);
        this.f4SubItemCalc();
    },

    f4SubItemRemove() {
        const container = document.getElementById('f4-sub-item-rows');
        if (!container) return;
        const rows = container.querySelectorAll('.f4-sub-item-row');
        if (rows.length <= 1) {
            // ล้างค่าแถวแรก
            rows[0]?.querySelectorAll('input').forEach(i => i.value = '');
        } else {
            rows[rows.length - 1].remove();
        }
        this.f4SubItemCalc();
    },

    f4SubItemCalc() {
        const container = document.getElementById('f4-sub-item-rows');
        if (!container) return;
        let totalQty = 0, totalAmt = 0;
        container.querySelectorAll('.f4-sub-item-row').forEach(row => {
            const qty   = parseFloat(row.querySelector('.f4si-qty')?.value  || 0);
            const price = parseFloat(row.querySelector('.f4si-price')?.value || 0);
            const sub   = qty * price;
            totalQty += qty;
            totalAmt += sub;
            const st = row.querySelector('.f4si-subtotal');
            if (st) st.textContent = sub.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });
        const tq = document.getElementById('f4si-total-qty');
        const ta = document.getElementById('f4si-total-amt');
        if (tq) tq.textContent = totalQty.toLocaleString('th-TH');
        if (ta) ta.textContent = totalAmt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    f4SubItemLoadRows(subItems) {
        const container = document.getElementById('f4-sub-item-rows');
        if (!container) return;
        container.innerHTML = '';
        const items = (subItems && subItems.length) ? subItems : [{}];
        items.forEach(it => container.appendChild(this.f4SubItemMakeRow(it.name||'', it.unit||'', it.qty||'', it.price||'')));
        this.f4SubItemCalc();
    },

    // ══════════════════════════════════════════════════════════════
    // FORM 4 (ง.4) — Records Table, Edit, Print, Delete
    // ══════════════════════════════════════════════════════════════

    async loadForm4Records() {
        const tbody = document.getElementById('f4-records-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400 text-xs font-bold">กำลังโหลด...</td></tr>';
        try {
            const snap = await db.collection('artifacts').doc(appId)
                .collection('public').doc('data').collection('form4')
                .orderBy('createdAt', 'desc').limit(50).get();
            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400 text-xs font-bold">ยังไม่มีรายการ</td></tr>';
                return;
            }
            tbody.innerHTML = '';
            snap.forEach((doc, idx) => {
                const d = doc.data();
                const id = doc.id;
                const cache = this._f4cache;
                // หา dept name จาก cache (แสดงหน่วยงาน ไม่ใช่สาขา)
                const deptName = (() => {
                    if (d.dept) {
                        const dt = (cache?.depts || []).find(x => x.id === d.dept);
                        if (dt) return dt.name;
                    }
                    return d.deptName || d.dept || '-';
                })();
                // หา item name
                const itemName = (() => {
                    if (d.item) {
                        const it = (cache?.items || []).find(x => x.id === d.item);
                        if (it) return it.name;
                    }
                    return d.itemName || d.item || '-';
                })();
                // หา plan name
                const planName = d.planName || d.plan || '-';
                const date = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('th-TH') : '-';
                const createdBy = d.createdBy || '-';

                tbody.insertAdjacentHTML('beforeend', `
                    <tr class="hover:bg-indigo-50/30 transition-colors">
                        <td class="px-4 py-3 text-center text-gray-400 text-xs">${idx + 1}</td>
                        <td class="px-4 py-3 font-bold text-indigo-900 text-sm">${itemName}</td>
                        <td class="px-4 py-3 text-xs text-gray-600">${deptName}</td>
                        <td class="px-4 py-3 text-xs text-gray-500">${planName}</td>
                        <td class="px-4 py-3 text-xs text-gray-400">${createdBy}</td>
                        <td class="px-4 py-3 text-xs text-gray-400">${date}</td>
                        <td class="px-4 py-3 text-center">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="App.loadForm4ToForm('${id}')"
                                    title="แก้ไข"
                                    class="p-2 rounded-xl bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all">
                                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                                </button>
                                <button onclick="App.printForm4('${id}')"
                                    title="Print / PDF"
                                    class="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all">
                                    <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                                </button>
                                <button onclick="App.deleteForm4App('${id}')"
                                    title="ลบ"
                                    class="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-all">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `);
            });
            lucide.createIcons();
        } catch (e) {
            console.error('loadForm4Records error', e);
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-red-400 text-xs font-bold">โหลดข้อมูลไม่สำเร็จ</td></tr>';
        }
    },

    async loadForm4ToForm(id) {
        try {
            this.showLoader();
            const docSnap = await db.collection('artifacts').doc(appId)
                .collection('public').doc('data').collection('form4').doc(id).get();
            if (!docSnap.exists) { this.hideLoader(); return alert('ไม่พบข้อมูล'); }
            const d = docSnap.data();

            // set hidden edit id
            const hid = document.getElementById('f4-edit-id');
            if (hid) hid.value = id;

            // fill fields
            const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
            setVal('f-dept', d.dept);
            setVal('f-year', d.year);
            setVal('f-budget-source', d.budgetSource);
            setVal('f-budget-other', d.budgetOther);
            setVal('f-item', d.item);
            setVal('f-item-desc', d.itemDesc);
            setVal('f-category', d.category);
            setVal('f-building-name', d.buildingName);
            setVal('f-building-year', d.buildingYear);
            setVal('f-need', d.need);
            setVal('f-objective2', d.objective);
            setVal('f-min-std', d.minStd);
            setVal('f-min-std-unit', d.minStdUnit);

            // cascade branch after dept
            if (d.dept) {
                await new Promise(r => setTimeout(r, 100));
                this.form4LoadBranches();
                await new Promise(r => setTimeout(r, 200));
                setVal('f-branch', d.branch);
            }

            // cascade plan chain
            if (d.plan) {
                setVal('f-plan', d.plan);
                this.form4Cascade('plan');
                await new Promise(r => setTimeout(r, 150));
                if (d.issue) {
                    setVal('f-issue', d.issue);
                    this.form4Cascade('issue');
                    await new Promise(r => setTimeout(r, 150));
                    if (d.strategy) {
                        setVal('f-strategy', d.strategy);
                        this.form4Cascade('strategy');
                    }
                }
            }

            // โหลด subItems
            this.f4SubItemLoadRows(d.subItems || []);

            alert('โหลดข้อมูลเข้าฟอร์มแล้ว — แก้ไขแล้วกด "บันทึก" เพื่ออัปเดต');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            console.error('loadForm4ToForm error', e);
            alert('โหลดข้อมูลไม่สำเร็จ');
        } finally {
            this.hideLoader();
        }
    },

    async printForm4(id) {
        try {
            await this.loadForm4ToForm(id);
            setTimeout(() => window.print(), 500);
        } catch(e) {
            console.error('printForm4 error', e);
        }
    },

    async deleteForm4App(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return;
        try {
            this.showLoader();
            await db.collection('artifacts').doc(appId)
                .collection('public').doc('data').collection('form4').doc(id).delete();
            alert('ลบสำเร็จ');
            await this.loadForm4Records();
        } catch(e) {
            console.error('deleteForm4App error', e);
            alert('ลบไม่สำเร็จ');
        } finally {
            this.hideLoader();
        }
    },

    // ══════════════════════════════════════════════════════════════
    // FORM 5 (ง.5) Functions
    // ══════════════════════════════════════════════════════════════

    async initManageForm5() {
        if (!document.getElementById('f5-year')) return;
        try {
            if (!this._f4cache) await this.initManageForm4();
            this.f5InitDropdowns();
            await this.loadForm5Records();
        } catch(e) { console.error('initManageForm5 error', e); }
    },

    async f5LoadBranches() {
        const deptEl = document.getElementById('f5-dept');
        const branchEl = document.getElementById('f5-branch');
        if (!deptEl || !branchEl) return;
        const deptId = deptEl.value;
        if (!deptId) { branchEl.innerHTML = '<option value="">— เลือกหน่วยงานก่อน —</option>'; return; }
        const branches = (this._f4cache?.branches || []).filter(b => b.deptId === deptId);
        branchEl.innerHTML = `<option value="">${branches.length ? '— เลือกสาขา/งาน —' : '— ไม่มีสาขา/งานในหน่วยงานนี้ —'}</option>` +
            branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    },

    f5InitDropdowns() {
        const cache = this._f4cache;
        const setOpts = (el, items) => {
            if (!el) return;
            const ph = el.options[0]?.value === '' ? el.options[0].text : '— เลือก —';
            el.innerHTML = `<option value="">${ph}</option>` +
                (items || []).map(x => `<option value="${x.id}">${x.name||x.id}</option>`).join('');
        };
        setOpts(document.getElementById('f5-year'), cache?.years);
        setOpts(document.getElementById('f5-dept'), cache?.depts);
        const branchEl = document.getElementById('f5-branch');
        if (branchEl) branchEl.innerHTML = '<option value="">— เลือกหน่วยงานก่อน —</option>';
        const body = document.getElementById('f5-construct-body');
        if (body && body.children.length === 0) { for(let i=0;i<3;i++) this.f5AddConstructRow(); }
        const kpiBody = document.getElementById('f5-kpi-plan-body');
        if (kpiBody && kpiBody.children.length === 0) this.f5AddKpiRow();
        this._f5MultiOptions = this._f5MultiOptions || {};
        this.f5InitStratDropdowns();
    },

    f5InitStratDropdowns() {
        const cache = this._f4cache;
        const issueEl = document.getElementById('f5-issue');
        if (!issueEl) return;
        if (!cache) { this.initManageForm4().then(() => this.f5InitStratDropdowns()).catch(()=>{}); return; }
        const links = cache.stratLinks || [];
        // รวม issues ทั้งหมดจาก strat_links (dedup)
        const seen = new Set();
        const issues = links
            .filter(l => l.issueId && !seen.has(l.issueId) && seen.add(l.issueId))
            .map(l => ({ id: l.issueId, name: l.issueName || l.issueId }));
        issueEl.disabled = false;
        issueEl.innerHTML = `<option value="">— เลือกประเด็นยุทธศาสตร์ —</option>` +
            this.f4SortByName(issues).map(x => `<option value="${x.id}">${x.name}</option>`).join('');
        issueEl.classList.add('f4-placeholder');
        issueEl.addEventListener('change', () => issueEl.value ? issueEl.classList.remove('f4-placeholder') : issueEl.classList.add('f4-placeholder'));
        // reset downstream
        ['f5-strategy','f5-dimension','f5-kpidim'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.disabled = true; el.innerHTML = '<option value="">— เลือกขั้นตอนก่อนหน้า —</option>'; el.classList.add('f4-placeholder'); }
        });
    },

    // Cascade สำหรับ Form5 Section B (ประเด็น → วัตถุประสงค์ → กลยุทธ์ → มิติ)
    f5StratCascade(step) {
        const cache = this._f4cache;
        if (!cache) return;
        const links = cache.stratLinks || [];
        const val = id => document.getElementById(id)?.value || '';
        const fill = (id, items, placeholder) => {
            const el = document.getElementById(id);
            if (!el) return;
            const seen = new Set();
            const uniq = items.filter(x => x.id && !seen.has(x.id) && seen.add(x.id));
            el.disabled = uniq.length === 0;
            el.innerHTML = `<option value="">${uniq.length ? placeholder : '— ไม่มีข้อมูล —'}</option>` +
                this.f4SortByName(uniq).map(x => `<option value="${x.id}">${x.name||x.id}</option>`).join('');
            if (!el.value) el.classList.add('f4-placeholder');
            el.addEventListener('change', () => el.value ? el.classList.remove('f4-placeholder') : el.classList.add('f4-placeholder'));
        };
        const lock = (id, ph) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = true; el.innerHTML = `<option value="">${ph}</option>`; el.classList.add('f4-placeholder');
        };

        if (step === 'issue') {
            const issueId = val('f5-issue');
            const strats = issueId ? links.filter(l => l.issueId === issueId) : [];
            const seenS = new Set();
            fill('f5-strategy',
                strats.filter(l => l.strategyId && !seenS.has(l.strategyId) && seenS.add(l.strategyId))
                      .map(l => ({ id: l.strategyId, name: l.strategyName || l.strategyId })),
                '— เลือกวัตถุประสงค์เชิงยุทธศาสตร์ —');
            lock('f5-dimension', '— เลือกวัตถุประสงค์ก่อน —');
            lock('f5-kpidim', '— เลือกกลยุทธ์ก่อน —');
        } else if (step === 'strategy') {
            const issueId = val('f5-issue'), strategyId = val('f5-strategy');
            const dims = strategyId ? links.filter(l => l.issueId === issueId && l.strategyId === strategyId) : [];
            const seenD = new Set();
            fill('f5-dimension',
                dims.filter(l => l.dimId && !seenD.has(l.dimId) && seenD.add(l.dimId))
                    .map(l => ({ id: l.dimId, name: l.dimName || l.dimId })),
                '— เลือกกลยุทธ์ —');
            lock('f5-kpidim', '— เลือกกลยุทธ์ก่อน —');
        } else if (step === 'dimension') {
            const issueId = val('f5-issue'), strategyId = val('f5-strategy'), dimId = val('f5-dimension');
            const kpiDims = dimId ? links.filter(l => l.issueId === issueId && l.strategyId === strategyId && l.dimId === dimId) : [];
            const seenK = new Set();
            fill('f5-kpidim',
                kpiDims.filter(l => l.kpiDimId && !seenK.has(l.kpiDimId) && seenK.add(l.kpiDimId))
                       .map(l => ({ id: l.kpiDimId, name: l.kpiDimName || l.kpiDimId })),
                '— เลือกมิติ —');
        }
    },

    f5GetMultiValues(step) {
        const cid = step === 'kpi' ? 'f5-kpi-multi-rows' : `f5-${step}-rows`;
        const c = document.getElementById(cid);
        if (!c) return [];
        return Array.from(c.querySelectorAll('select')).map(s => s.value).filter(Boolean);
    },

    f5RenderMultiRows(step, options, placeholder, onChangeStep) {
        const cid = step === 'kpi' ? 'f5-kpi-multi-rows' : `f5-${step}-rows`;
        const c = document.getElementById(cid);
        if (!c) return;
        this._f5MultiOptions = this._f5MultiOptions || {};
        this._f5MultiOptions[step] = options || [];
        const prev = this.f5GetMultiValues(step);
        const hasData = (options || []).length > 0;
        const buildOpts = (sel) => `<option value="">${hasData ? placeholder : '— ไม่มีข้อมูล —'}</option>` +
            (options || []).map(o => `<option value="${o.id}"${o.id === sel ? ' selected' : ''}>${o.name}</option>`).join('');
        let keep = prev.filter(v => (options || []).some(o => o.id === v));
        if (!keep.length) keep = [''];
        c.innerHTML = keep.map(v => `<select class="f4-strat-select f4-multi-select" data-step="${step}" ${hasData ? '' : 'disabled'} onchange="App.f5OnMultiChange('${step}','${onChangeStep||''}')">${buildOpts(v)}</select>`).join('');
        c.querySelectorAll('select').forEach(s => { if (!s.value) s.classList.add('f4-placeholder'); else s.classList.remove('f4-placeholder'); });
    },

    f5AddMultiRow(step) {
        const cid = step === 'kpi' ? 'f5-kpi-multi-rows' : `f5-${step}-rows`;
        const c = document.getElementById(cid);
        if (!c) return;
        this._f5MultiOptions = this._f5MultiOptions || {};
        const opts = this._f5MultiOptions[step] || [];
        if (!opts.length) return alert('ยังไม่มีข้อมูลให้เลือกเพิ่ม กรุณาเลือกขั้นตอนก่อนหน้าให้ครบก่อน');
        const ocs = step === 'dimension' ? 'dimension' : (step === 'substrategy' ? 'substrategy' : '');
        const sel = document.createElement('select');
        sel.className = 'f4-strat-select f4-multi-select f4-placeholder';
        sel.dataset.step = step;
        sel.setAttribute('onchange', `App.f5OnMultiChange('${step}','${ocs}')`);
        sel.innerHTML = `<option value="">เลือก...</option>` + opts.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        c.appendChild(sel);
        if (window.lucide) lucide.createIcons();
    },

    f5RemoveMultiRow(step) {
        const cid = step === 'kpi' ? 'f5-kpi-multi-rows' : `f5-${step}-rows`;
        const c = document.getElementById(cid);
        if (!c) return;
        const rows = c.querySelectorAll('select');
        if (rows.length <= 1) { rows[0] && (rows[0].value = ''); }
        else rows[rows.length - 1].remove();
        if (step === 'dimension') this.f5CascadeStep('dimension');
        else if (step === 'substrategy') this.f5CascadeStep('substrategy');
    },

    f5OnMultiChange(step, onChangeStep) {
        const cid = step === 'kpi' ? 'f5-kpi-multi-rows' : `f5-${step}-rows`;
        document.querySelectorAll(`#${cid} select`).forEach(s => {
            if (!s.value) s.classList.add('f4-placeholder'); else s.classList.remove('f4-placeholder');
        });
        if (onChangeStep) this.f5CascadeStep(onChangeStep);
    },

    f5CascadeStep(step) {
        const cache = this._f4cache;
        if (!cache) return;
        const links = cache.stratLinks || [];
        const val = id => document.getElementById(id)?.value || '';
        const lock = (id, ph) => { const el = document.getElementById(id); if (!el) return; el.disabled = true; el.innerHTML = `<option value="">${ph}</option>`; el.classList.add('f4-placeholder'); };
        const fill = (id, items, ph) => {
            const el = document.getElementById(id); if (!el) return;
            const seen = new Set(); const uniq = items.filter(x => x.id && !seen.has(x.id) && seen.add(x.id));
            el.disabled = uniq.length === 0;
            el.innerHTML = `<option value="">${uniq.length ? ph : '— ไม่มีข้อมูล —'}</option>` + uniq.map(x => `<option value="${x.id}">${x.name||x.id}</option>`).join('');
            if (!el.value) el.classList.add('f4-placeholder');
            el.addEventListener('change', () => el.value ? el.classList.remove('f4-placeholder') : el.classList.add('f4-placeholder'));
        };
        const fl = (fn, iF, nF) => this.fromLinks(links, fn, iF, nF);
        const sor = (sf, rf, iF, nF) => { const s = fl(sf, iF, nF); return s.length ? s : fl(rf, iF, nF); };
        const lm = (s) => this.f5RenderMultiRows(s, [], '— เลือกขั้นตอนก่อนหน้า —');
        if (step === 'plan') {
            const planId = val('f5-plan');
            fill('f5-issue', planId ? fl(l => l.planId === planId, 'issueId', 'issueName') : [], '— เลือกประเด็นยุทธศาสตร์ —');
            lock('f5-strategy','— เลือกประเด็นก่อน —'); lm('dimension'); lm('substrategy'); lock('f5-kpidim','— เลือกกลยุทธ์ก่อน —'); lm('kpi');
        } else if (step === 'issue') {
            const planId = val('f5-plan'), issueId = val('f5-issue');
            fill('f5-strategy', issueId ? sor(l => l.planId===planId && l.issueId===issueId, l => l.issueId===issueId, 'strategyId','strategyName') : [], '— เลือกวัตถุประสงค์เชิงยุทธศาสตร์ —');
            lm('dimension'); lm('substrategy'); lock('f5-kpidim','— เลือกกลยุทธ์ก่อน —'); lm('kpi');
        } else if (step === 'strategy') {
            const planId = val('f5-plan'), issueId = val('f5-issue'), strategyId = val('f5-strategy');
            const dims = strategyId ? sor(l => l.planId===planId && l.issueId===issueId && l.strategyId===strategyId, l => l.issueId===issueId && l.strategyId===strategyId, 'dimId','dimName') : [];
            this.f5RenderMultiRows('dimension', dims, '— เลือกกลยุทธ์ —', 'dimension');
            lm('substrategy'); lock('f5-kpidim','— เลือกกลยุทธ์ก่อน —'); lm('kpi');
        } else if (step === 'dimension') {
            const planId = val('f5-plan'), issueId = val('f5-issue'), strategyId = val('f5-strategy');
            const dimIds = this.f5GetMultiValues('dimension');
            let subs = [], kpiDims = [];
            if (dimIds.length) {
                dimIds.forEach(dimId => {
                    subs = subs.concat(sor(l => l.planId===planId && l.issueId===issueId && l.strategyId===strategyId && l.dimId===dimId, l => l.strategyId===strategyId && l.dimId===dimId, 'subId','subName'));
                    kpiDims = kpiDims.concat(sor(l => l.planId===planId && l.issueId===issueId && l.strategyId===strategyId && l.dimId===dimId, l => l.strategyId===strategyId && l.dimId===dimId, 'kpiDimId','kpiDimName'));
                });
                const s1 = new Set(), s2 = new Set();
                subs = this.f4SortByName(subs.filter(x => !s1.has(x.id) && s1.add(x.id)));
                kpiDims = this.f4SortByName(kpiDims.filter(x => !s2.has(x.id) && s2.add(x.id)));
            }
            this.f5RenderMultiRows('substrategy', subs, '— เลือกกลยุทธ์ย่อย (ถ้ามี) —', 'substrategy');
            fill('f5-kpidim', kpiDims, '— เลือกมิติ —'); lm('kpi');
        } else if (step === 'substrategy') {
            const planId = val('f5-plan'), issueId = val('f5-issue'), strategyId = val('f5-strategy');
            const dimIds = this.f5GetMultiValues('dimension'), subIds = this.f5GetMultiValues('substrategy');
            if (subIds.length && dimIds.length) {
                let kpiDims = [];
                dimIds.forEach(dimId => subIds.forEach(subId => { kpiDims = kpiDims.concat(sor(l => l.planId===planId && l.issueId===issueId && l.strategyId===strategyId && l.dimId===dimId && l.subId===subId, l => l.dimId===dimId && l.subId===subId, 'kpiDimId','kpiDimName')); }));
                const seen = new Set(); kpiDims = this.f4SortByName(kpiDims.filter(x => !seen.has(x.id) && seen.add(x.id)));
                fill('f5-kpidim', kpiDims, '— เลือกมิติ —'); lm('kpi');
            }
        } else if (step === 'kpidim') {
            const planId = val('f5-plan'), issueId = val('f5-issue'), strategyId = val('f5-strategy');
            const dimIds = this.f5GetMultiValues('dimension'), kpiDimId = val('f5-kpidim');
            let kpis = [];
            if (kpiDimId && dimIds.length) {
                dimIds.forEach(dimId => { kpis = kpis.concat(sor(l => l.planId===planId && l.issueId===issueId && l.strategyId===strategyId && l.dimId===dimId && l.kpiDimId===kpiDimId, l => l.dimId===dimId && l.kpiDimId===kpiDimId, 'kpiId','kpiName')); });
                const seen = new Set(); kpis = this.f4SortByName(kpis.filter(x => !seen.has(x.id) && seen.add(x.id)));
            } else if (kpiDimId) kpis = fl(l => l.kpiDimId === kpiDimId, 'kpiId', 'kpiName');
            this.f5RenderMultiRows('kpi', kpis, '— เลือกตัวชี้วัด —');
        }
    },

    f5AddConstructRow() {
        const body = document.getElementById('f5-construct-body');
        if (!body) return;
        const rowNum = body.children.length + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-3 py-2 text-center text-gray-400 text-xs font-bold">${rowNum}</td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white text-xs f5-construct-desc" placeholder="รายการ..."></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white text-xs f5-qty" type="number" placeholder="0" oninput="App.f5CalcRow(this)"></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white text-xs f5-unit" placeholder="หน่วย"></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white text-xs f5-price" type="number" placeholder="0.00" oninput="App.f5CalcRow(this)"></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-gray-50 text-xs f5-rowsum text-right font-bold" type="number" placeholder="0.00" readonly></td>
            <td class="px-3 py-2 no-print"><button onclick="this.closest('tr').remove();App.f5RecalcSum()" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" size="14"></i></button></td>`;
        body.appendChild(tr);
        if (window.lucide) lucide.createIcons();
    },

    f5RemoveConstructRow() {
        const body = document.getElementById('f5-construct-body');
        if (body && body.lastElementChild) body.lastElementChild.remove();
        this.f5RecalcSum();
    },

    f5CalcRow(input) {
        const tr = input.closest('tr');
        if (!tr) return;
        const qty = parseFloat(tr.querySelector('.f5-qty')?.value) || 0;
        const price = parseFloat(tr.querySelector('.f5-price')?.value) || 0;
        const rowSumEl = tr.querySelector('.f5-rowsum');
        if (rowSumEl) rowSumEl.value = (qty * price).toFixed(2);
        this.f5RecalcSum();
    },

    f5RecalcSum() {
        let total = 0;
        document.querySelectorAll('.f5-rowsum').forEach(el => { total += parseFloat(el.value) || 0; });
        const sumEl = document.getElementById('f5-construct-sum');
        if (sumEl) sumEl.textContent = total.toFixed(2);
    },

    f5BuildKpiOptions() {
        const cache = this._f4cache;
        if (!cache) return '<option value="">— ยังไม่มีข้อมูลตัวชี้วัด —</option>';
        const kpiItems = (cache.kpis || []).filter(k => k.type === 'kpi');
        const seen = new Set();
        const uniq = kpiItems.filter(k => k.name && !seen.has(k.name) && seen.add(k.name));
        if (!uniq.length) return '<option value="">— ยังไม่มีข้อมูลตัวชี้วัด —</option>';
        return '<option value="">— เลือกตัวชี้วัด —</option>' + uniq.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
    },

    f5AddKpiRow() {
        const body = document.getElementById('f5-kpi-plan-body');
        if (!body) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-3 py-2"><select class="input-flat w-full bg-white text-xs f5-kpi-select">${this.f5BuildKpiOptions()}</select></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white text-xs" placeholder="ค่าเป้าหมาย"></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white text-xs" placeholder="หน่วยนับ"></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white text-xs text-right" type="number" placeholder="0"></td>
            <td class="px-3 py-2 no-print"><button onclick="this.closest('tr').remove()" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" size="14"></i></button></td>`;
        body.appendChild(tr);
        if (window.lucide) lucide.createIcons();
    },

    f5RemoveKpiRow() {
        const body = document.getElementById('f5-kpi-plan-body');
        if (body && body.lastElementChild) body.lastElementChild.remove();
    },

    f5SwitchAnalysisCase(n) {
        [1,2,3,4].forEach(i => {
            const el = document.getElementById(`f5-analysis-case-${i}`);
            if (el) el.classList.toggle('hidden', i !== n);
        });
    },

    resetForm5() {
        ['f5-year','f5-dept','f5-branch','f5-item-name','f5-budget-total',
         'f5-commit-2570','f5-commit-2571','f5-commit-2572',
         'f5-budget-source','f5-budget-other','f5-location',
         'f5-need','f5-objective','f5-other-note',
         'f5-demolish-source','f5-demolish-date','f5-design-date','f5-design-other',
         'f5-plan-arch','f5-plan-struct','f5-plan-sanit','f5-plan-elec','f5-plan-total',
         'f5-area-sqm','f5-price-sqm',
         'f5-coord-name','f5-coord-position','f5-coord-phone-office','f5-coord-phone-mobile','f5-coord-email',
         'f5-result-ult','f5-result-ult-unit','f5-result-out','f5-result-out-unit','f5-result-prod','f5-result-prod-unit',
         'f5-edit-id'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
        document.querySelectorAll('[name^="f5-"]').forEach(el => { el.checked = false; });
        const body = document.getElementById('f5-construct-body');
        if (body) { body.innerHTML = ''; for(let i=0;i<3;i++) this.f5AddConstructRow(); }
        const kpiBody = document.getElementById('f5-kpi-plan-body');
        if (kpiBody) { kpiBody.innerHTML = ''; this.f5AddKpiRow(); }
        [1,2,3,4].forEach(i => { const el = document.getElementById(`f5-analysis-case-${i}`); if(el) el.classList.add('hidden'); });
        // reset cascade strategy dropdowns
        const issueEl = document.getElementById('f5-issue');
        if (issueEl) { issueEl.value = ''; issueEl.classList.add('f4-placeholder'); }
        ['f5-strategy','f5-dimension','f5-kpidim'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.disabled = true; el.innerHTML = '<option value="">— เลือกขั้นตอนก่อนหน้า —</option>'; el.classList.add('f4-placeholder'); }
        });
        this.f5RecalcSum();
        ['cnt-f5-need','cnt-f5-obj','cnt-f5-note'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '0'; });
    },

    async saveForm5() {
        try {
            const constructRows = Array.from(document.querySelectorAll('#f5-construct-body tr')).map(tr => ({
                desc: tr.querySelector('.f5-construct-desc')?.value || '',
                qty: tr.querySelector('.f5-qty')?.value || '',
                unit: tr.querySelector('.f5-unit')?.value || '',
                price: tr.querySelector('.f5-price')?.value || '',
                rowSum: tr.querySelector('.f5-rowsum')?.value || ''
            }));
            const kpiRows = Array.from(document.querySelectorAll('#f5-kpi-plan-body tr')).map(tr => {
                const sel = tr.querySelector('.f5-kpi-select');
                const inputs = tr.querySelectorAll('input');
                return { kpiId: sel?.value||'', kpi: sel?.selectedOptions?.[0]?.text||sel?.value||'', target: inputs[0]?.value||'', unit: inputs[1]?.value||'', amount: inputs[2]?.value||'' };
            });
            const months = ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'];
            const signPlan = {}, payPlan = {};
            months.forEach(m => { signPlan[m] = document.getElementById(`f5-sign-${m}`)?.value||''; payPlan[m] = document.getElementById(`f5-pay-${m}`)?.value||''; });
            const stratIssue = document.getElementById('f5-issue')?.value||'';
            const stratIssueName = document.getElementById('f5-issue')?.selectedOptions?.[0]?.text||'';
            const stratStrategy = document.getElementById('f5-strategy')?.value||'';
            const stratStrategyName = document.getElementById('f5-strategy')?.selectedOptions?.[0]?.text||'';
            const stratDimension = document.getElementById('f5-dimension')?.value||'';
            const stratDimensionName = document.getElementById('f5-dimension')?.selectedOptions?.[0]?.text||'';
            const stratKpiDim = document.getElementById('f5-kpidim')?.value||'';
            const stratKpiDimName = document.getElementById('f5-kpidim')?.selectedOptions?.[0]?.text||'';
            const payload = {
                year: document.getElementById('f5-year')?.value||'',
                dept: document.getElementById('f5-dept')?.value||'',
                deptName: document.getElementById('f5-dept')?.selectedOptions?.[0]?.text||'',
                branch: document.getElementById('f5-branch')?.value||'',
                branchName: document.getElementById('f5-branch')?.selectedOptions?.[0]?.text||'',
                itemName: document.getElementById('f5-item-name')?.value||'',
                budgetTotal: document.getElementById('f5-budget-total')?.value||'',
                commit2570: document.getElementById('f5-commit-2570')?.value||'',
                commit2571: document.getElementById('f5-commit-2571')?.value||'',
                commit2572: document.getElementById('f5-commit-2572')?.value||'',
                constructType: document.querySelector('[name="f5-construct-type"]:checked')?.value||'',
                budgetSource: document.getElementById('f5-budget-source')?.value||'',
                budgetOther: document.getElementById('f5-budget-other')?.value||'',
                location: document.getElementById('f5-location')?.value||'',
                stratIssue, stratIssueName,
                stratStrategy, stratStrategyName,
                stratDimension, stratDimensionName,
                stratKpiDim, stratKpiDimName,
                need: document.getElementById('f5-need')?.value||'',
                objective: document.getElementById('f5-objective')?.value||'',
                siteReady: document.querySelector('[name="f5-site-ready"]:checked')?.value||'',
                demolishSource: document.getElementById('f5-demolish-source')?.value||'',
                demolishDate: document.getElementById('f5-demolish-date')?.value||'',
                designReady: document.querySelector('[name="f5-design-ready"]:checked')?.value||'',
                designDate: document.getElementById('f5-design-date')?.value||'',
                designOther: document.getElementById('f5-design-other')?.value||'',
                planArch: document.getElementById('f5-plan-arch')?.value||'',
                planStruct: document.getElementById('f5-plan-struct')?.value||'',
                planSanit: document.getElementById('f5-plan-sanit')?.value||'',
                planElec: document.getElementById('f5-plan-elec')?.value||'',
                planTotal: document.getElementById('f5-plan-total')?.value||'',
                areaSqm: document.getElementById('f5-area-sqm')?.value||'',
                priceSqm: document.getElementById('f5-price-sqm')?.value||'',
                constructRows, signPlan, payPlan,
                otherNote: document.getElementById('f5-other-note')?.value||'',
                kpiRows,
                resultUlt: document.getElementById('f5-result-ult')?.value||'',
                resultUltUnit: document.getElementById('f5-result-ult-unit')?.value||'',
                resultOut: document.getElementById('f5-result-out')?.value||'',
                resultOutUnit: document.getElementById('f5-result-out-unit')?.value||'',
                resultProd: document.getElementById('f5-result-prod')?.value||'',
                resultProdUnit: document.getElementById('f5-result-prod-unit')?.value||'',
                analysisCase: document.querySelector('[name="f5-analysis-case"]:checked')?.value||'',
                coordName: document.getElementById('f5-coord-name')?.value||'',
                coordPosition: document.getElementById('f5-coord-position')?.value||'',
                coordPhoneOffice: document.getElementById('f5-coord-phone-office')?.value||'',
                coordPhoneMobile: document.getElementById('f5-coord-phone-mobile')?.value||'',
                coordEmail: document.getElementById('f5-coord-email')?.value||'',
                savedBy: currentUser?.username||'',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (!payload.itemName) return alert('กรุณาระบุรายการสิ่งก่อสร้าง');
            if (!payload.dept) return alert('กรุณาเลือกหน่วยงาน');
            this.showLoader();
            const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('form5');
            const editId = document.getElementById('f5-edit-id')?.value||'';
            if (editId) await col.doc(editId).set(payload, { merge: true });
            else {
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const ref = await col.add(payload);
                const hid = document.getElementById('f5-edit-id');
                if (hid) hid.value = ref.id;
            }
            alert('บันทึกเรียบร้อย');
            await this.loadForm5Records();
        } catch(e) { console.error('saveForm5 error', e); alert('บันทึกไม่สำเร็จ'); }
        finally { this.hideLoader(); }
    },

    async loadForm5Records() {
        const tbody = document.getElementById('f5-records-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400 text-xs font-bold">กำลังโหลด...</td></tr>';
        try {
            const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
                .collection('form5').orderBy('createdAt', 'desc').limit(50).get();
            if (snap.empty) { tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400 text-xs font-bold">ยังไม่มีรายการ</td></tr>'; return; }
            tbody.innerHTML = '';
            snap.forEach((doc, idx) => {
                const d = doc.data();
                const date = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('th-TH') : '-';
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-indigo-50/30 transition-colors';
                tr.innerHTML = `
                    <td class="px-4 py-3 text-center text-gray-400 text-xs font-bold">${idx+1}</td>
                    <td class="px-4 py-3 font-bold text-sm text-indigo-900">${d.itemName||'-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-600">${d.deptName||d.dept||'-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-600">${d.constructType||'-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${d.savedBy||'-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">${date}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="App.editForm5('${doc.id}')" class="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg" title="แก้ไข"><i data-lucide="pencil" size="14"></i></button>
                            <button onclick="App.deleteForm5('${doc.id}')" class="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg" title="ลบ"><i data-lucide="trash-2" size="14"></i></button>
                        </div>
                    </td>`;
                tbody.appendChild(tr);
            });
            if (window.lucide) lucide.createIcons();
        } catch(e) { console.error('loadForm5Records error', e); tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-red-400 text-xs font-bold">โหลดข้อมูลไม่สำเร็จ</td></tr>'; }
    },

    async editForm5(id) {
        try {
            this.showLoader();
            const doc = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('form5').doc(id).get();
            if (!doc.exists) return alert('ไม่พบข้อมูล');
            const d = doc.data();
            this.resetForm5();
            const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val||''; };
            setVal('f5-edit-id', id);
            setVal('f5-year', d.year); setVal('f5-dept', d.dept);
            if (d.dept) { await this.f5LoadBranches(); setVal('f5-branch', d.branch); }
            setVal('f5-item-name', d.itemName); setVal('f5-budget-total', d.budgetTotal);
            setVal('f5-commit-2570', d.commit2570); setVal('f5-commit-2571', d.commit2571); setVal('f5-commit-2572', d.commit2572);
            setVal('f5-budget-source', d.budgetSource); setVal('f5-budget-other', d.budgetOther);
            setVal('f5-location', d.location);
            setVal('f5-need', d.need); setVal('f5-objective', d.objective);
            setVal('f5-other-note', d.otherNote);
            setVal('f5-plan-arch', d.planArch); setVal('f5-plan-struct', d.planStruct);
            setVal('f5-plan-sanit', d.planSanit); setVal('f5-plan-elec', d.planElec); setVal('f5-plan-total', d.planTotal);
            setVal('f5-area-sqm', d.areaSqm); setVal('f5-price-sqm', d.priceSqm);
            setVal('f5-coord-name', d.coordName); setVal('f5-coord-position', d.coordPosition);
            setVal('f5-coord-phone-office', d.coordPhoneOffice); setVal('f5-coord-phone-mobile', d.coordPhoneMobile);
            setVal('f5-coord-email', d.coordEmail);
            if (d.constructType) { const r = document.querySelector(`[name="f5-construct-type"][value="${d.constructType}"]`); if(r) r.checked = true; }
            if (d.siteReady) { const r = document.querySelector(`[name="f5-site-ready"][value="${d.siteReady}"]`); if(r) r.checked = true; }
            if (d.designReady) { const r = document.querySelector(`[name="f5-design-ready"][value="${d.designReady}"]`); if(r) r.checked = true; }
            // Restore cascade strategy dropdowns (4 ขั้น)
            if (d.stratIssue) {
                const issueEl = document.getElementById('f5-issue');
                if (issueEl) { issueEl.value = d.stratIssue; issueEl.classList.remove('f4-placeholder'); }
                this.f5StratCascade('issue'); await new Promise(r => setTimeout(r, 50));
            }
            if (d.stratStrategy) {
                const el = document.getElementById('f5-strategy');
                if (el) { el.value = d.stratStrategy; el.classList.remove('f4-placeholder'); }
                this.f5StratCascade('strategy'); await new Promise(r => setTimeout(r, 50));
            }
            if (d.stratDimension) {
                const el = document.getElementById('f5-dimension');
                if (el) { el.value = d.stratDimension; el.classList.remove('f4-placeholder'); }
                this.f5StratCascade('dimension'); await new Promise(r => setTimeout(r, 50));
            }
            if (d.stratKpiDim) {
                const el = document.getElementById('f5-kpidim');
                if (el) { el.value = d.stratKpiDim; el.classList.remove('f4-placeholder'); }
            }
            const months = ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'];
            months.forEach(m => { setVal(`f5-sign-${m}`, d.signPlan?.[m]); setVal(`f5-pay-${m}`, d.payPlan?.[m]); });
            const body = document.getElementById('f5-construct-body');
            if (body && d.constructRows?.length) {
                body.innerHTML = ''; d.constructRows.forEach(() => this.f5AddConstructRow());
                body.querySelectorAll('tr').forEach((row, i) => {
                    if (!d.constructRows[i]) return;
                    const r = d.constructRows[i];
                    row.querySelector('.f5-construct-desc').value = r.desc||'';
                    row.querySelector('.f5-qty').value = r.qty||'';
                    row.querySelector('.f5-unit').value = r.unit||'';
                    row.querySelector('.f5-price').value = r.price||'';
                    row.querySelector('.f5-rowsum').value = r.rowSum||'';
                });
            }
            this.f5RecalcSum();
            const kpiBody = document.getElementById('f5-kpi-plan-body');
            if (kpiBody && d.kpiRows?.length) {
                kpiBody.innerHTML = ''; d.kpiRows.forEach(r => {
                    this.f5AddKpiRow();
                    const last = kpiBody.lastElementChild; if (!last) return;
                    const sel = last.querySelector('.f5-kpi-select'); if (sel && r.kpiId) sel.value = r.kpiId;
                    const inputs = last.querySelectorAll('input');
                    if (inputs[0]) inputs[0].value = r.target||'';
                    if (inputs[1]) inputs[1].value = r.unit||'';
                    if (inputs[2]) inputs[2].value = r.amount||'';
                });
            }
            setVal('f5-result-ult', d.resultUlt); setVal('f5-result-ult-unit', d.resultUltUnit);
            setVal('f5-result-out', d.resultOut); setVal('f5-result-out-unit', d.resultOutUnit);
            setVal('f5-result-prod', d.resultProd); setVal('f5-result-prod-unit', d.resultProdUnit);
            if (d.analysisCase) { const r = document.querySelector(`[name="f5-analysis-case"][value="${d.analysisCase}"]`); if(r) { r.checked = true; this.f5SwitchAnalysisCase(parseInt(d.analysisCase)); } }
            ['f5-need','f5-objective','f5-other-note'].forEach(id => document.getElementById(id)?.dispatchEvent(new Event('input')));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch(e) { console.error('editForm5 error', e); alert('โหลดข้อมูลไม่สำเร็จ'); }
        finally { this.hideLoader(); }
    },

    async deleteForm5(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return;
        try {
            this.showLoader();
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('form5').doc(id).delete();
            alert('ลบเรียบร้อย');
            await this.loadForm5Records();
        } catch(e) { console.error('deleteForm5 error', e); alert('ลบไม่สำเร็จ'); }
        finally { this.hideLoader(); }
    },

    // --- Master Data Ops ---
    async saveMaster(col, inputId) {
        const val = document.getElementById(inputId).value.trim();
        if (!val) return alert("กรุณาระบุข้อมูล");
        this.showLoader();
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection(col).add({ name: val, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById(inputId).value = ''; this.loadAdminAllTables(); this.hideLoader();
    },

    async saveUnits() {
        const u1 = document.getElementById('m-unit-1').value.trim();
        const u2 = document.getElementById('m-unit-2').value.trim();
        const u3 = document.getElementById('m-unit-3').value.trim();
        const u4 = document.getElementById('m-unit-4').value.trim(); // เพิ่มช่องที่ 4
        
        if (!u1 && !u2 && !u3 && !u4) return alert("ระบุหน่วยนับอย่างน้อย 1 ช่อง");
        
        this.showLoader();
        // บันทึกแยกทีละอัน
        const batch = db.batch();
        [u1, u2, u3, u4].forEach(u => {
            if(u) {
                const ref = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('units').doc();
                batch.set(ref, { name: u, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
        });
        await batch.commit();
        
        document.getElementById('m-unit-1').value = '';
        document.getElementById('m-unit-2').value = '';
        document.getElementById('m-unit-3').value = '';
        document.getElementById('m-unit-4').value = '';
        alert("บันทึกหน่วยนับเรียบร้อย");
        await this.loadAdminTable('units');
        this.renderAdminTable('units');
        this.hideLoader();
    },

    // --- Admin Setup Init (เฉพาะหน้า ผู้ดูแลระบบ > ตั้งต้นข้อมูล) ---
    initAdminSetup() {
        // ตั้งค่า Dropdown ความสัมพันธ์ยุทธศาสตร์
        this.initStratLinkingUI();

        // ตั้งค่า "การวิเคราะห์ครุภัณฑ์" ให้ผู้ใช้เลือกเอง (ไม่เลือกค่าเริ่มต้น)
        this.initAnalysisCaseSelector();

        // ตั้งค่าแบบฟอร์มวิเคราะห์ครุภัณฑ์ (กรณี 1)
        this.initAnalysisCase1UI();

        // โหลดตารางกรณี 1 (เผื่อพร้อมแสดงเมื่อเลือกกรณี)
        this.loadAnalysisCase1Table();

        // โหลดตารางข้อมูลตั้งต้น (ทุกหมวด) + เติม Dropdown หน่วยงานสำหรับสาขา/งาน
        this.fillDeptSelectForBranches();
        this.loadAdminAllTables();
    },

    // --- หมวดข้อมูลยุทธศาสตร์และตัวชี้วัด (ความสัมพันธ์ 9-12) ---
    initStratLinkingUI() {
        // ลำดับใหม่ (ตามภาพ):
        const s10 = document.getElementById('strat-parent-10');
        const s11 = document.getElementById('strat-parent-11');
        const s12 = document.getElementById('strat-parent-12');
        const s13 = document.getElementById('strat-parent-13');
        const s14 = document.getElementById('strat-parent-14');

        if (!s10 || !s11 || !s12 || !s13) return;

        const container = s10.closest('.space-y-6') || s10.parentElement?.parentElement?.parentElement;
        if (container && !container._stratDelegated) {
            container._stratDelegated = true;
            container.addEventListener('change', (e) => {
                if (this._stratPopulating) return;
                const id = e.target?.id;
                if      (id === 'strat-parent-10')  this.onStratPlanChange();
                else if (id === 'strat-parent-11')  this.onStratIssueChange();
                else if (id === 'strat-parent-12')  this.onStratStrategyChange();
                else if (id === 'strat-parent-13')  this.onStratDimChange();
                else if (id === 'strat-parent-13b') this.onStratSubStrategyChange();
                else if (id === 'strat-parent-14')  this.onStratKpiChange();
            });
        }

        this.fillStratPlanSelect();
    },

adminResetStratLinkingUI() {
    const ids = ['strat-parent-10','strat-parent-11','strat-parent-12','strat-parent-13','strat-parent-13b','strat-parent-14'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const inputs = ['strat-lvl-9','strat-lvl-10','strat-lvl-11','strat-lvl-12','strat-lvl-13','strat-lvl-13b','strat-lvl-14'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // เคลียร์ค้นหา/หน้า ของตารางรวม
    const s = document.getElementById('adm-search-strat_links');
    if (s) s.value = '';
    const st = adminTableState['strat_links'];
    if (st) { st.searchQuery = ''; st.page = 1; }

    // รีไอคอน
    try { lucide.createIcons(); } catch {}
},

async saveStratNew(level) {
        try {
            if (!db) return alert("Firebase Error");
            const dataRoot = db.collection('artifacts').doc(appId).collection('public').doc('data');
            const ts = { createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' };

            // Level 9 = บันทึกฉบับแผน → strat_plans
            if (level === 9) {
                const name = (document.getElementById('strat-lvl-9')?.value || '').trim();
                if (!name) return alert("กรุณาระบุชื่อฉบับแผน");
                this.showLoader();
                await dataRoot.collection('strat_plans').add({ name, ...ts });
                document.getElementById('strat-lvl-9').value = '';
                await this.fillStratPlanSelect();     // reload dropdown ฉบับแผน
                await this.refreshAdminStratLinks();  // reload ตารางบันทึกผล
                this.hideLoader();
                alert("บันทึกฉบับแผนเรียบร้อยแล้ว");
                return;
            }

            // Level 10 = บันทึกประเด็นยุทธศาสตร์ → strat_issues (parent = plan)
            if (level === 10) {
                const planId = document.getElementById('strat-parent-10')?.value || '';
                const name   = (document.getElementById('strat-lvl-10')?.value || '').trim();
                if (!planId) return alert("กรุณาเลือกฉบับแผนก่อน");
                if (!name)   return alert("กรุณาระบุประเด็นยุทธศาสตร์");
                this.showLoader();
                await dataRoot.collection('strat_issues').add({ planId, name, ...ts });
                document.getElementById('strat-lvl-10').value = '';
                await this.fillStratIssueSelect(planId);
                await this.refreshAdminStratLinks();
                this.hideLoader();
                alert("บันทึกความเชื่อมโยงข้อมูลเรียบร้อยแล้ว");
                return;
            }

            // Level 11 = บันทึกวัตถุประสงค์เชิงยุทธศาสตร์ → strat_strategies (parent = issue)
            if (level === 11) {
                const issueId = document.getElementById('strat-parent-11')?.value || '';
                const name    = (document.getElementById('strat-lvl-11')?.value || '').trim();
                if (!issueId) return alert("กรุณาเลือกประเด็นยุทธศาสตร์ก่อน");
                if (!name)    return alert("กรุณาระบุวัตถุประสงค์เชิงยุทธศาสตร์");
                this.showLoader();
                const planId = document.getElementById('strat-parent-10')?.value || '';
                await dataRoot.collection('strat_strategies').add({ issueId, planId, name, ...ts });
                document.getElementById('strat-lvl-11').value = '';
                await this.fillStratStrategySelect(issueId);
                await this.refreshAdminStratLinks();
                this.hideLoader();
                alert("บันทึกความเชื่อมโยงข้อมูลเรียบร้อยแล้ว");
                return;
            }

            // Level 12 = บันทึกกลยุทธ์ → strat_dimensions (parent = strategy)
            if (level === 12) {
                const strategyId = document.getElementById('strat-parent-12')?.value || '';
                const name       = (document.getElementById('strat-lvl-12')?.value || '').trim();
                if (!strategyId) return alert("กรุณาเลือกวัตถุประสงค์เชิงยุทธศาสตร์ก่อน");
                if (!name)       return alert("กรุณาระบุกลยุทธ์");
                this.showLoader();
                const issueId = document.getElementById('strat-parent-11')?.value || '';
                const planId  = document.getElementById('strat-parent-10')?.value || '';
                await dataRoot.collection('strat_dimensions').add({ strategyId, issueId, planId, name, ...ts });
                document.getElementById('strat-lvl-12').value = '';
                await this.fillStratDimSelect(strategyId);
                await this.refreshAdminStratLinks();
                this.hideLoader();
                alert("บันทึกความเชื่อมโยงข้อมูลเรียบร้อยแล้ว");
                return;
            }

            // Level 13 = บันทึกกลยุทธ์ใหม่ → strat_dimensions (parent = strat_strategies)
            if (level === 13) {
                const strategyId = document.getElementById('strat-parent-12')?.value || '';
                const name       = (document.getElementById('strat-lvl-13')?.value || '').trim();
                if (!strategyId) return alert("กรุณาเลือกวัตถุประสงค์เชิงยุทธศาสตร์ก่อน");
                if (!name)       return alert("กรุณาระบุชื่อกลยุทธ์");
                this.showLoader();
                const issueId = document.getElementById('strat-parent-11')?.value || '';
                const planId  = document.getElementById('strat-parent-10')?.value || '';
                await dataRoot.collection('strat_dimensions').add({ strategyId, issueId, planId, name, ...ts });
                document.getElementById('strat-lvl-13').value = '';
                await this.fillStratDimSelect(strategyId);   // reload กลยุทธ์ใน dropdown 13
                await this.refreshAdminStratLinks();
                this.hideLoader();
                alert("บันทึกกลยุทธ์เรียบร้อยแล้ว");
                return;
            }

            // Level 13.5 = บันทึกกลยุทธ์ย่อย → strat_sub_strategies (parent = strat_dimensions)
            if (level === 13.5) {
                const dimId = document.getElementById('strat-parent-13')?.value || '';
                const name  = (document.getElementById('strat-lvl-13')?.value || '').trim();
                if (!dimId) return alert("กรุณาเลือกกลยุทธ์ก่อน");
                if (!name)  return alert("กรุณาระบุกลยุทธ์ย่อย");
                this.showLoader();
                const strategyId = document.getElementById('strat-parent-12')?.value || '';
                const issueId    = document.getElementById('strat-parent-11')?.value || '';
                const planId     = document.getElementById('strat-parent-10')?.value || '';
                const newRef = await dataRoot.collection('strat_sub_strategies').add({ dimId, strategyId, issueId, planId, name, ...ts });
                document.getElementById('strat-lvl-13').value = '';
                // reload dropdown กลยุทธ์ย่อย แล้ว auto-select doc ใหม่ เพื่อให้ dropdown มิติโหลดได้ทันที
                await this.fillStratSubStrategySelect(dimId);
                const sel13b = document.getElementById('strat-parent-13b');
                if (sel13b && newRef.id) {
                    sel13b.value = newRef.id;
                    sel13b.disabled = false;
                    sel13b.classList.remove('opacity-60');
                }
                await this.fillStratKpiDimBySubStrat(newRef.id);  // โหลด มิติ ที่ผูกกับกลยุทธ์ย่อยใหม่
                await this.refreshAdminStratLinks();
                this.hideLoader();
                alert("บันทึกกลยุทธ์ย่อยเรียบร้อยแล้ว — กรุณาเลือกมิติและตัวชี้วัดต่อ");
                return;
            }

            // Level 14 = บันทึกมิติ → strat_kpis type='dimension' (subStrategyId = sub-strategy selected)
            if (level === 14) {
                const subStratId = document.getElementById('strat-parent-13b')?.value || '';
                const name       = (document.getElementById('strat-lvl-13b')?.value || '').trim();
                if (!subStratId) return alert("กรุณาเลือกกลยุทธ์ย่อยก่อน");
                if (!name)       return alert("กรุณาระบุมิติ");
                this.showLoader();
                const dimId      = document.getElementById('strat-parent-13')?.value  || '';
                const strategyId = document.getElementById('strat-parent-12')?.value  || '';
                const issueId    = document.getElementById('strat-parent-11')?.value  || '';
                const planId     = document.getElementById('strat-parent-10')?.value  || '';
                await dataRoot.collection('strat_kpis').add({ bscId: dimId, subStrategyId: subStratId, strategyId, issueId, planId, name, type: 'dimension', ...ts });
                document.getElementById('strat-lvl-13b').value = '';
                await this.fillStratKpiDimBySubStrat(subStratId);
                await this.refreshAdminStratLinks();
                this.hideLoader();
                alert("บันทึกมิติเรียบร้อยแล้ว");
                return;
            }

            // Level 15 = บันทึกตัวชี้วัด → strat_kpis type='kpi' (parent = strat_kpis type=dimension)
            if (level === 15) {
                // ปุ่มอยู่ที่ row-14: dropdown=strat-parent-14(มิติ), input=strat-lvl-14(ตัวชี้วัด)
                const bscId = document.getElementById('strat-parent-14')?.value || '';
                const name  = (document.getElementById('strat-lvl-14')?.value || '').trim();
                if (!bscId) return alert("กรุณาเลือกมิติก่อน");
                if (!name)  return alert("กรุณาระบุตัวชี้วัด");
                this.showLoader();
                const subStrategyId = document.getElementById('strat-parent-13b')?.value || '';
                const dimId         = document.getElementById('strat-parent-13')?.value  || '';
                const strategyId    = document.getElementById('strat-parent-12')?.value  || '';
                const issueId       = document.getElementById('strat-parent-11')?.value  || '';
                const planId        = document.getElementById('strat-parent-10')?.value  || '';
                await dataRoot.collection('strat_kpis').add({ bscId, subStrategyId, dimId, strategyId, issueId, planId, name, type: 'kpi', ...ts });
                document.getElementById('strat-lvl-14').value = '';
                await this.refreshAdminStratLinks();
                this.hideLoader();
                alert("บันทึกตัวชี้วัดเรียบร้อยแล้ว");
                return;
            }

        } catch (err) {
            console.error(err);
            this.hideLoader();
            alert("เกิดข้อผิดพลาด: " + err.message);
        }
    },

    // ========== Cascade handlers ==========
    // flag กัน onchange ที่ browser trigger ขณะ programmatically set innerHTML
    _stratPopulating: false,

    async onStratPlanChange() {
        if (this._stratPopulating) return;
        const planId = document.getElementById('strat-parent-10')?.value || '';
        this._resetStratBelow(11);
        if (!planId) return;
        await this.fillStratIssueSelect(planId);
    },

    async onStratIssueChange() {
        if (this._stratPopulating) return;
        const issueId = document.getElementById('strat-parent-11')?.value || '';
        this._resetStratBelow(12);
        if (!issueId) return;
        await this.fillStratStrategySelect(issueId);
    },

    async onStratStrategyChange() {
        if (this._stratPopulating) return;
        const strategyId = document.getElementById('strat-parent-12')?.value || '';
        this._resetStratBelow(13);
        if (!strategyId) return;
        await this.fillStratDimSelect(strategyId);
    },

    async onStratDimChange() {
        if (this._stratPopulating) return;
        const dimId = document.getElementById('strat-parent-13')?.value || '';
        this._resetStratBelow('13b');
        if (!dimId) return;
        await this.fillStratSubStrategySelect(dimId);
    },

    async onStratSubStrategyChange() {
        if (this._stratPopulating) return;
        const subStratId = document.getElementById('strat-parent-13b')?.value || '';
        this._resetStratBelow(14);
        if (!subStratId) return;
        await this.fillStratKpiDimBySubStrat(subStratId);
    },

    async fillStratKpiDimBySubStrat(subStratId) {
        if (!subStratId) { this._resetStratBelow(14); return; }
        const dataRoot = db.collection('artifacts').doc(appId).collection('public').doc('data');

        // 1) ลองหามิติที่ผูกกับ subStrategyId ตรงๆ ก่อน
        let snap = await dataRoot.collection('strat_kpis')
            .where('subStrategyId', '==', subStratId).where('type', '==', 'dimension').get();
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th', { numeric: true }));

        if (!docs.length) {
            // 2) fallback: ดึง dimId จาก subStrategy doc แล้วหามิติที่ bscId == dimId หรือ subStrategyId == '' (มิติร่วม)
            const subSnap = await dataRoot.collection('strat_sub_strategies').doc(subStratId).get();
            const dimId = subSnap.exists ? (subSnap.data().dimId || '') : '';
            if (dimId) {
                // ลองหา dimension kpis ที่ผูกกับ dimId
                const snap2 = await dataRoot.collection('strat_kpis')
                    .where('bscId', '==', dimId).where('type', '==', 'dimension').get();
                docs = snap2.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th', { numeric: true }));

                if (!docs.length) {
                    // 3) fallback สุดท้าย: หาทุก kpi ที่เป็น dimension ใน bscId นี้
                    const snap3 = await dataRoot.collection('strat_kpis')
                        .where('bscId', '==', dimId).get();
                    docs = snap3.docs.map(d => ({ id: d.id, ...d.data() }))
                        .filter(d => d.type !== 'kpi')
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th', { numeric: true }));
                }
            }
        }
        this._setStratOptions('strat-parent-14', docs, 'เลือกมิติ');
    },

    async onStratKpiChange() {
        if (this._stratPopulating) return;
        const kpiDimId = document.getElementById('strat-parent-14')?.value || '';
        // ล้าง input ตัวชี้วัด
        const inp = document.getElementById('strat-lvl-14');
        if (inp) inp.value = '';
        // reset + populate dropdown ตัวชี้วัด (strat-parent-15)
        this._resetStratBelow(15);
        if (!kpiDimId) return;
        await this.fillStratKpiSelect(kpiDimId);
    },

    // ปุ่มบันทึกสีเขียว row-15: บันทึกการเชื่อมโยงที่เลือกครบทุก step ลงตาราง strat_links
    _resetStratBelow(fromLevel) {
        const order = [11, 12, 13, '13b', 14, 15];
        const from  = order.indexOf(fromLevel);
        if (from === -1) return;
        order.slice(from).forEach(l => {
            const sel = document.getElementById(`strat-parent-${l}`);
            const inp = document.getElementById(`strat-lvl-${l}`);
            if (sel) {
                const clone = sel.cloneNode(false);
                clone.onchange = sel.onchange;
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = this._noDataOption(l);
                clone.appendChild(opt);
                clone.disabled = true;
                clone.classList.add('opacity-60');
                sel.replaceWith(clone);
            }
            if (inp) inp.value = '';
        });
    },

    _noDataOption(level) {
        const labels = { 11:'เลือกยุทธศาสตร์', 12:'เลือกวัตถุประสงค์ฯ', 13:'เลือกกลยุทธ์', '13b':'เลือกกลยุทธ์ย่อย', 14:'เลือกมิติ', 15:'เลือกตัวชี้วัด' };
        return labels[level] || 'เลือก...';
    },

    _setStratOptions(selId, docs, emptyLabel) {
        const sel = document.getElementById(selId);
        if (!sel) return;

        // ตั้ง flag กัน onchange fire — ต้องปิด listener ชั่วคราว
        // โดยใช้ replaceWith clone เพื่อหลีกเลี่ยง onchange trigger จาก innerHTML
        this._stratPopulating = true;

        // สร้าง element ใหม่แทน innerHTML เพื่อไม่ให้ browser fire onchange
        const clone = sel.cloneNode(false); // cloneNode(false) = ไม่ copy children
        clone.onchange = sel.onchange; // คืน event handler

        if (!docs || !docs.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'ยังไม่มีข้อมูล กรุณาระบุข้อมูลก่อน';
            clone.appendChild(opt);
            clone.disabled = true;
            clone.classList.add('opacity-60');
        } else {
            const seen = new Set();
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = emptyLabel;
            clone.appendChild(emptyOpt);

            docs.filter(d => {
                if (seen.has(d.name)) return false;
                seen.add(d.name);
                return true;
            }).forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name;
                clone.appendChild(opt);
            });

            clone.disabled = false;
            clone.classList.remove('opacity-60');
        }

        // แทนที่ element เดิม (ไม่ trigger onchange เพราะ DOM swap)
        sel.replaceWith(clone);

        // ปลด flag ทันที (ไม่ต้องรอ setTimeout เพราะใช้ replaceWith แล้ว)
        this._stratPopulating = false;
    },

    async fillStratPlanSelect() {
        const sel = document.getElementById('strat-parent-10');
        if (!sel) return;
        const dataRoot = db.collection('artifacts').doc(appId).collection('public').doc('data');
        const snap = await dataRoot.collection('strat_plans').orderBy('createdAt', 'desc').get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const seen = new Set();
        const opts = docs.filter(d => d.name && !seen.has(d.name) && seen.add(d.name))
            .map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        sel.innerHTML = '<option value="">เลือกฉบับที่</option>' + opts;
        this._resetStratBelow(11);
    },

    async fillStratIssueSelect(planId) {
        if (!planId) { this._resetStratBelow(11); return; }
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_issues').where('planId', '==', planId).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        this._setStratOptions('strat-parent-11', docs, 'เลือกยุทธศาสตร์');
        // ไม่ reset ขั้น 12 อัตโนมัติ — รอให้ผู้ใช้เลือก issue ก่อน
    },

    async fillStratStrategySelect(issueId) {
        if (!issueId) { this._resetStratBelow(12); return; }
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_strategies').where('issueId', '==', issueId).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        this._setStratOptions('strat-parent-12', docs, 'เลือกวัตถุประสงค์ฯ');
        // ไม่ reset ขั้น 13 อัตโนมัติ — รอให้ผู้ใช้เลือก strategy ก่อน
    },

    async fillStratDimSelect(strategyId) {
        if (!strategyId) { this._resetStratBelow(13); return; }
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_dimensions').where('strategyId', '==', strategyId).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        this._setStratOptions('strat-parent-13', docs, 'เลือกกลยุทธ์');
    },

    async fillStratSubStrategySelect(dimId) {
        if (!dimId) { this._resetStratBelow('13b'); return; }
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_sub_strategies').where('dimId', '==', dimId).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        this._setStratOptions('strat-parent-13b', docs, 'เลือกกลยุทธ์ย่อย');
    },

    // populate มิติ (strat_kpis type=dimension) ใน dropdown 14
    async fillStratKpiDimSelect(dimId) {
        if (!dimId) { this._resetStratBelow(14); return; }
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_kpis').where('bscId', '==', dimId).where('type', '==', 'dimension').get();
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        if (!docs.length) {
            const snap2 = await db.collection('artifacts').doc(appId).collection('public').doc('data')
                .collection('strat_kpis').where('bscId', '==', dimId).get();
            docs = snap2.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(d => d.type !== 'kpi')
                .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        }
        this._setStratOptions('strat-parent-14', docs, 'เลือกมิติ');
    },

    // populate ตัวชี้วัด (strat_kpis type=kpi) ใน dropdown 15
    async fillStratKpiSelect(kpiDimId) {
        if (!kpiDimId) { this._resetStratBelow(15); return; }
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_kpis').where('bscId', '==', kpiDimId).where('type', '==', 'kpi').get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        this._setStratOptions('strat-parent-15', docs, 'เลือกตัวชี้วัด');
    },

    // alias เดิม
    async fillBscSelect(strategyId) { return this.fillStratDimSelect(strategyId); },

    // --- หมวดการวิเคราะห์ครุภัณฑ์ตามวัตถุประสงค์ (กรณี 1) ---
    switchAnalysisCase(caseNo) {
        const hint = document.getElementById('analysis-case-hint');
        if (hint) hint.classList.add('hidden');

        [1,2,3,4].forEach(n => {
            const el = document.getElementById(`analysis-case-${n}`);
            if (el) el.classList.toggle('hidden', n !== caseNo);
        });
    },

    initAnalysisCaseSelector() {
        const radios = document.querySelectorAll('input[name="analysis-case"]');
        if (!radios || radios.length === 0) return;

        // เคลียร์การเลือกเริ่มต้น (ให้ผู้ใช้เลือกเอง)
        radios.forEach(r => { r.checked = false; r.disabled = false; });

        // ซ่อนทุกกรณี และโชว์คำแนะนำ
        [1,2,3,4].forEach(n => {
            const el = document.getElementById(`analysis-case-${n}`);
            if (el) el.classList.add('hidden');
        });

        const hint = document.getElementById('analysis-case-hint');
        if (hint) hint.classList.remove('hidden');
    },


    initAnalysisCase1UI() {
        // ตั้งค่า default ซ่อน textareas ที่ผูกกับตัวเลือก
        ['a1-q2-2.2','a1-q2-2.3','a1-q2-2.4','a1-q4-4.1','a1-q4-4.2','a1-q5-5.1','a1-q5-5.2','a1-q5-5.3','a1-q5-5.5']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
    },

    toggleCase1Option(groupPrefix, val) {
        const map = {
            'a1-q2': ['2.2','2.3','2.4'],
            'a1-q4': ['4.1','4.2'],
            'a1-q5': ['5.1','5.2','5.3','5.5']
        };
        (map[groupPrefix] || []).forEach(v => {
            const el = document.getElementById(`${groupPrefix}-${v}`);
            if (el) el.classList.add('hidden');
        });

        const t = document.getElementById(`${groupPrefix}-${val}`);
        if (t) t.classList.remove('hidden');
    },

    resetAnalysisCase1() {
        const ids = ['analysis-edit-id','a1-q1','a1-q2-history','a1-q3'];
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        // clear radios
        ['a1-q2-opt','a1-q4-opt','a1-q5-opt'].forEach(name => {
            document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.checked = false);
        });
        // hide option textareas
        this.initAnalysisCase1UI();
    },

    async saveAnalysisCase1() {
        try {
            if (!db) return alert("Firebase Error");

            const editId = document.getElementById('analysis-edit-id')?.value || '';

            const q1 = (document.getElementById('a1-q1')?.value || '').trim();
            const q2_history = (document.getElementById('a1-q2-history')?.value || '').trim();
            const q3 = (document.getElementById('a1-q3')?.value || '').trim();

            const q2_opt = document.querySelector('input[name="a1-q2-opt"]:checked')?.value || '';
            const q2_detail = (document.getElementById(`a1-q2-${q2_opt}`)?.value || '').trim();

            const q4_opt = document.querySelector('input[name="a1-q4-opt"]:checked')?.value || '';
            const q4_detail = (document.getElementById(`a1-q4-${q4_opt}`)?.value || '').trim();

            const q5_opt = document.querySelector('input[name="a1-q5-opt"]:checked')?.value || '';
            const q5_detail = (document.getElementById(`a1-q5-${q5_opt}`)?.value || '').trim();

            // บังคับเลือก 1 ข้อในชุดที่กำหนดตามโจทย์
            if (!q2_opt) return alert("กรุณาเลือกสถานะการใช้งานครุภัณฑ์เดิม");
            if (!q4_opt) return alert("กรุณาเลือกการใช้งานครุภัณฑ์ร่วมกับส่วนราชการอื่น");
            if (!q5_opt) return alert("กรุณาเลือกสรุปทางเลือกการจัดหา");

            const payload = {
                caseType: 1,
                q1,
                q2_history,
                q2_opt,
                q2_detail,
                q3,
                q4_opt,
                q4_detail,
                q5_opt,
                q5_detail,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser?.name || ''
            };

            this.showLoader();

            const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('analysis_case1');

            if (editId) {
                await col.doc(editId).update(payload);
            } else {
                await col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
            }

            alert("บันทึกสำเร็จ");
            this.resetAnalysisCase1();
            await this.loadAnalysisCase1Table();
            this.hideLoader();
        } catch (err) {
            console.error(err);
            this.hideLoader();
            alert("เกิดข้อผิดพลาด");
        }
    },

    async loadAnalysisCase1Table() {
        const tbody = document.getElementById('analysis-table-body');
        if (!tbody) return;

        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('analysis_case1').orderBy('createdAt', 'desc').get();

        analysisState.fullData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        analysisState.page = 1;
        this.renderAnalysisTable();
    },

    renderAnalysisTable() {
        const tbody = document.getElementById('analysis-table-body');
        if (!tbody) return;

        const q = (analysisState.searchQuery || '').toLowerCase();
        const filtered = analysisState.fullData.filter(r => {
            const hay = `${r.q2_opt || ''} ${r.q5_opt || ''} ${r.q1 || ''} ${r.q3 || ''}`.toLowerCase();
            return hay.includes(q);
        });

        const start = (analysisState.page - 1) * analysisState.limit;
        const paged = filtered.slice(start, start + analysisState.limit);

        const pageInfo = document.getElementById('analysis-page-info');
        if (pageInfo) pageInfo.innerText = `หน้า ${analysisState.page}`;

        const fmtDate = (ts) => {
            try {
                if (!ts) return '-';
                const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
                return d.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
            } catch { return '-'; }
        };

        tbody.innerHTML = paged.map(r => `
            <tr class="hover:bg-indigo-50/20 transition-all">
                <td class="px-6 py-4 font-bold text-indigo-900">${fmtDate(r.createdAt)}</td>
                <td class="px-6 py-4">${r.q2_opt || '-'}</td>
                <td class="px-6 py-4">${r.q5_opt || '-'}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="App.editAnalysisCase1('${r.id}')" class="text-amber-500 hover:bg-amber-50 p-2 rounded-lg transition-all"><i data-lucide="edit-3" size="18"></i></button>
                        <button onclick="App.deleteAnalysisCase1('${r.id}')" class="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"><i data-lucide="trash-2" size="18"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();
    },

    filterAnalysisTable() {
        analysisState.searchQuery = document.getElementById('analysis-search-input')?.value || '';
        analysisState.page = 1;
        this.renderAnalysisTable();
    },

    prevAnalysisPage() {
        if (analysisState.page > 1) { analysisState.page--; this.renderAnalysisTable(); }
    },

    nextAnalysisPage() {
        const q = (analysisState.searchQuery || '').toLowerCase();
        const filteredLen = analysisState.fullData.filter(r => (`${r.q2_opt||''} ${r.q5_opt||''} ${r.q1||''} ${r.q3||''}`).toLowerCase().includes(q)).length;
        if (analysisState.page * analysisState.limit < filteredLen) { analysisState.page++; this.renderAnalysisTable(); }
    },

    editAnalysisCase1(id) {
        const r = analysisState.fullData.find(x => x.id === id);
        if (!r) return;

        document.getElementById('analysis-edit-id').value = id;
        document.getElementById('a1-q1').value = r.q1 || '';
        document.getElementById('a1-q2-history').value = r.q2_history || '';
        document.getElementById('a1-q3').value = r.q3 || '';

        // set radios & show textareas
        if (r.q2_opt) {
            document.querySelectorAll('input[name="a1-q2-opt"]').forEach(x => x.checked = (x.value === r.q2_opt));
            this.toggleCase1Option('a1-q2', r.q2_opt);
            const t = document.getElementById(`a1-q2-${r.q2_opt}`);
            if (t) t.value = r.q2_detail || '';
        }

        if (r.q4_opt) {
            document.querySelectorAll('input[name="a1-q4-opt"]').forEach(x => x.checked = (x.value === r.q4_opt));
            this.toggleCase1Option('a1-q4', r.q4_opt);
            const t = document.getElementById(`a1-q4-${r.q4_opt}`);
            if (t) t.value = r.q4_detail || '';
        }

        if (r.q5_opt) {
            document.querySelectorAll('input[name="a1-q5-opt"]').forEach(x => x.checked = (x.value === r.q5_opt));
            this.toggleCase1Option('a1-q5', r.q5_opt);
            const t = document.getElementById(`a1-q5-${r.q5_opt}`);
            if (t) t.value = r.q5_detail || '';
        }

        // scroll into view
        document.getElementById('analysis-case-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    async deleteAnalysisCase1(id) {
        if (!confirm("ลบรายการนี้ใช่ไหม?")) return;
        this.showLoader();
        await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('analysis_case1').doc(id).delete();
        await this.loadAnalysisCase1Table();
        this.hideLoader();
    },


// =========================
// Admin Setup: ตารางข้อมูลตั้งต้น (แสดงข้อมูลจริงจาก Firestore)
// =========================
getAdminColRef(key) {
    const real = (key === 'strat_kpis_dim' || key === 'strat_kpis_kpi') ? 'strat_kpis' : key;
    return db.collection('artifacts').doc(appId).collection('public').doc('data').collection(real);
},

ensureAdminTableState(key) {
    if (!adminTableState[key]) adminTableState[key] = { page: 1, limit: 10, fullData: [], searchQuery: '' };
    return adminTableState[key];
},

async loadAdminTable(key) {
    if (key === 'strat_kpis_dim' || key === 'strat_kpis_kpi') {
        this._buildKpisVirtual(); this.renderAdminTable(key); return;
    }
    try {
        const st = this.ensureAdminTableState(key);
        const colRef = this.getAdminColRef(key);
        let snap;
        try { snap = await colRef.orderBy('createdAt', 'desc').get(); }
        catch { snap = await colRef.get(); }
        st.fullData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (st.page < 1) st.page = 1;
        this.renderAdminTable(key);
    } catch (e) { console.error('loadAdminTable error', key, e); }
},

_buildKpisVirtual() {
    const all = adminTableState['strat_kpis']?.fullData || [];
    const sd  = this.ensureAdminTableState('strat_kpis_dim');
    const sk  = this.ensureAdminTableState('strat_kpis_kpi');
    sd.fullData = all.filter(k => k.type === 'dimension' || !k.type);
    sk.fullData = all.filter(k => k.type === 'kpi');
    if (sd.page < 1) sd.page = 1;
    if (sk.page < 1) sk.page = 1;
},

async loadAdminAllTables() {
    if (typeof db === 'undefined') return;
    const keys = ['budget_types','years','units','sub_categories','asset_standards','items','categories',
                  'depts','branches','strat_plans','strat_issues','strat_strategies',
                  'strat_dimensions','strat_sub_strategies','strat_kpis','strat_links'];
    for (const k of keys) await this.loadAdminTable(k);
    this.adminBuildStratMaps();
    this.adminBuildStratLinks();
    this._buildKpisVirtual();
    ['strat_issues','strat_strategies','strat_dimensions','strat_sub_strategies',
     'strat_kpis','strat_kpis_dim','strat_kpis_kpi','strat_links'].forEach(k => this.renderAdminTable(k));
    // init dropdown ส่วน B + ตาราง 1
    setTimeout(() => { this._lnkLoadPlans(); this._stratT1Cur=1; this._stratT1Render(); }, 300);
},

// ===== ส่วน A: บันทึกรายหัวข้อ =====
async saveStratItem(col, inputId, type) {
    const name = document.getElementById(inputId)?.value?.trim() || '';
    if (!name) return alert('กรุณาระบุข้อมูล');
    try {
        this.showLoader();
        const payload = { name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' };
        if (type) payload.type = type;
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection(col).add(payload);
        document.getElementById(inputId).value = '';
        await this.loadAdminTable(col);
        if (['strat_plans','strat_issues','strat_strategies','strat_dimensions','strat_sub_strategies','strat_kpis'].includes(col)) {
            this._buildKpisVirtual();
            ['strat_kpis_dim','strat_kpis_kpi'].forEach(k => this.renderAdminTable(k));
            this._lnkLoadPlans();
        }
        alert('บันทึกเรียบร้อยแล้ว');
    } catch(e) { console.error(e); alert('บันทึกไม่สำเร็จ'); }
    finally { this.hideLoader(); }
},

// ===== ส่วน B: 7-Step linking =====
_lnkPop: false,

async _lnkLoadPlans() {
    const sel = document.getElementById('lnk-plan');
    if (!sel) return;
    const docs = (adminTableState['strat_plans']?.fullData || []).filter(p => p.active !== false);
    if (docs.length) {
        this._lnkFill(sel, docs, '— เลือกฉบับที่ —');
    } else {
        try {
            const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
                .collection('strat_plans').where('active', '!=', false).get().catch(() =>
                    db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('strat_plans').get()
                );
            this._lnkFill(sel, snap.docs.map(d=>({id:d.id,...d.data()})).filter(p => p.active !== false), '— เลือกฉบับที่ —');
        } catch(e) { console.error('_lnkLoadPlans error', e); }
    }
    this._lnkReset('issue');
},

_lnkReset(from) {
    // รีเซ็ต options และ disable dropdown ชั้นล่าง รอให้ _lnkFill เปิดใหม่
    const order = ['issue','strategy','dim','sub','kpidim','kpi'];
    const fi = order.indexOf(from);
    if (fi < 0) return;
    const labels = { issue:'— เลือกยุทธศาสตร์ —', strategy:'— เลือกวัตถุประสงค์ฯ —',
                     dim:'— เลือกกลยุทธ์ —', sub:'— เลือกกลยุทธ์ย่อย —',
                     kpidim:'— เลือกมิติ —', kpi:'— เลือกตัวชี้วัด —' };
    order.slice(fi).forEach(id => {
        const el = document.getElementById(`lnk-${id}`);
        if (!el) return;
        el.innerHTML = `<option value="">${labels[id]}</option>`;
        el.value = '';
        el.disabled = true;
        el.classList.add('opacity-60');
    });
},

_lnkFill(sel, docs, placeholder) {
    if (!sel) return;
    const seen = new Set();
    const uniqDocs = docs.filter(d => d.name && !seen.has(d.name) && seen.add(d.name));
    // เรียงตามเลขนำหน้าในชื่อ (เช่น 1.1, 1.2 ... 1.10) ไม่ใช่ตามลำดับที่โหลดมา/วันที่บันทึก
    const sortedDocs = this.f4SortByName(uniqDocs.map(d => ({ id: d.id, name: d.name })));
    const opts = sortedDocs.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    sel.innerHTML = `<option value="">${placeholder}</option>` + opts;
    // เปิด dropdown เสมอ (แม้ไม่มีข้อมูล ให้แสดง placeholder)
    sel.disabled = false;
    sel.classList.remove('opacity-60');
},

async onLinkChange(step) {
    // ใช้ข้อมูลจาก adminTableState (โหลดไว้แล้วตอน loadAdminAllTables) แทน Firestore query
    // เพื่อหลีกเลี่ยงปัญหา composite index และทำงานได้ทันที
    const mem = key => (adminTableState[key]?.fullData || []);
    const v   = id  => document.getElementById(`lnk-${id}`)?.value || '';

    if (step === 'plan') {
        this._lnkReset('issue');
        const planId = v('plan');
        if (!planId) return;
        const docs = mem('strat_issues').filter(x => (x.planId || '') === planId);
        const el = document.getElementById('lnk-issue');
        this._lnkFill(el, docs.length ? docs : mem('strat_issues'), '— เลือกยุทธศาสตร์ —');

    } else if (step === 'issue') {
        this._lnkReset('strategy');
        const issueId = v('issue');
        if (!issueId) return;
        const docs = mem('strat_strategies').filter(x => (x.issueId || x.parentId || '') === issueId);
        const el = document.getElementById('lnk-strategy');
        this._lnkFill(el, docs.length ? docs : mem('strat_strategies'), '— เลือกวัตถุประสงค์ฯ —');

    } else if (step === 'strategy') {
        this._lnkReset('dim');
        const strategyId = v('strategy');
        if (!strategyId) return;
        const docs = mem('strat_dimensions').filter(x => (x.strategyId || x.parentId || '') === strategyId);
        const el = document.getElementById('lnk-dim');
        this._lnkFill(el, docs.length ? docs : mem('strat_dimensions'), '— เลือกกลยุทธ์ —');

    } else if (step === 'dim') {
        this._lnkReset('sub');
        const dimId = v('dim');
        if (!dimId) return;
        const docs = mem('strat_sub_strategies').filter(x => (x.dimId || x.parentId || '') === dimId);
        const el = document.getElementById('lnk-sub');
        this._lnkFill(el, docs.length ? docs : mem('strat_sub_strategies'), '— เลือกกลยุทธ์ย่อย —');

    } else if (step === 'sub') {
        this._lnkReset('kpidim');
        const subId = v('sub');
        if (!subId) return;
        const allKpis = mem('strat_kpis');
        const dims = allKpis.filter(x => x.type === 'dimension' || !x.type);
        // filter ตาม subStrategyId ก่อน
        let docs = dims.filter(x => (x.subStrategyId || '') === subId);
        // fallback: filter ตาม bscId ที่ผูกกับ dimId ของ sub
        if (!docs.length) {
            const subRec = mem('strat_sub_strategies').find(x => x.id === subId);
            const dimId  = subRec?.dimId || '';
            if (dimId) docs = dims.filter(x => (x.bscId || x.dimId || '') === dimId);
        }
        // fallback สุดท้าย: แสดงทุกมิติ
        if (!docs.length) docs = dims;
        docs = [...new Map(docs.map(d => [d.name, d])).values()]
            .sort((a,b) => (a.name||'').localeCompare(b.name||'','th',{numeric:true}));
        const el = document.getElementById('lnk-kpidim');
        this._lnkFill(el, docs, '— เลือกมิติ —');

    } else if (step === 'kpidim') {
        this._lnkReset('kpi');
        const kpiDimId = v('kpidim');
        if (!kpiDimId) return;
        const allKpis = mem('strat_kpis');
        let docs = allKpis.filter(x => x.type === 'kpi' && (x.bscId || x.dimId || x.parentId || '') === kpiDimId);
        // fallback: แสดงทุก kpi
        if (!docs.length) docs = allKpis.filter(x => x.type === 'kpi');
        docs = [...new Map(docs.map(d => [d.name, d])).values()]
            .sort((a,b) => (a.name||'').localeCompare(b.name||'','th',{numeric:true}));
        const el = document.getElementById('lnk-kpi');
        this._lnkFill(el, docs, '— เลือกตัวชี้วัด —');
    }
},

async saveStratLink() {
    const v  = id => document.getElementById(`lnk-${id}`)?.value || '';
    const tx = id => { const el=document.getElementById(`lnk-${id}`); return el?(el.options[el.selectedIndex]?.text||''):'' };
    const planId=v('plan'), issueId=v('issue'), strategyId=v('strategy'),
          dimId=v('dim'), subId=v('sub'), kpiDimId=v('kpidim'), kpiId=v('kpi');
    if (!planId)     return alert('กรุณาเลือกฉบับแผน (Step 1)');
    if (!issueId)    return alert('กรุณาเลือกประเด็นยุทธศาสตร์ (Step 2)');
    if (!strategyId) return alert('กรุณาเลือกวัตถุประสงค์ฯ (Step 3)');
    if (!dimId)      return alert('กรุณาเลือกกลยุทธ์ (Step 4)');
    if (!subId)      return alert('กรุณาเลือกกลยุทธ์ย่อย (Step 5)');
    if (!kpiDimId)   return alert('กรุณาเลือกมิติ (Step 6)');
    if (!kpiId)      return alert('กรุณาเลือกตัวชี้วัด (Step 7)');
    try {
        this.showLoader();
        await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_links').add({
                planId, planName:tx('plan'), issueId, issueName:tx('issue'),
                strategyId, strategyName:tx('strategy'), dimId, dimName:tx('dim'),
                subId, subName:tx('sub'), kpiDimId, kpiDimName:tx('kpidim'),
                kpiId, kpiName:tx('kpi'),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser?.name || ''
            });
        await this.loadAdminTable('strat_links');
        this.adminBuildStratLinks();
        this.renderAdminTable('strat_links');
        alert('บันทึกความเชื่อมโยงเรียบร้อยแล้ว ✅');
    } catch(e) { console.error(e); alert('บันทึกไม่สำเร็จ: '+e.message); }
    finally { this.hideLoader(); }
},

// ===== ตาราง 1 navigation =====
_stratT1Cur: 1,
_stratT1Items: [
    {id:'strat-t1-p1', label:'ฉบับแผนพัฒนามหาวิทยาลัย'},
    {id:'strat-t1-p2', label:'ประเด็นยุทธศาสตร์'},
    {id:'strat-t1-p3', label:'วัตถุประสงค์เชิงยุทธศาสตร์'},
    {id:'strat-t1-p4', label:'กลยุทธ์'},
    {id:'strat-t1-p5', label:'กลยุทธ์ย่อย'},
    {id:'strat-t1-p6', label:'มิติ'},
    {id:'strat-t1-p7', label:'ตัวชี้วัด'},
],
_stratT1Render() {
    const cur = this._stratT1Cur, total = this._stratT1Items.length;
    this._stratT1Items.forEach((p,i) => {
        const el = document.getElementById(p.id);
        if (el) el.classList.toggle('hidden', i+1 !== cur);
    });
    const badge = document.getElementById('strat-t1-badge');
    if (badge) badge.textContent = `หน้า ${cur} / ${total} — ${this._stratT1Items[cur-1]?.label||''}`;
    lucide.createIcons();
},
stratT1Next() { if(this._stratT1Cur < this._stratT1Items.length){this._stratT1Cur++;this._stratT1Render();} },
stratT1Prev() { if(this._stratT1Cur > 1){this._stratT1Cur--;this._stratT1Render();} },


async refreshAdminStratLinks() {
    // รีเฟรชตาราง "แผนพัฒนาฯ และความเชื่อมโยง" ให้ดึงข้อมูลจริงล่าสุดจากฐานข้อมูล
    // (แก้เคสเพิ่มข้อมูลแล้วไม่แสดง เพราะ state ยังไม่ reload)
    if (typeof db === 'undefined') return;
    await this.loadAdminTable('strat_plans');
    await this.loadAdminTable('strat_issues');
    await this.loadAdminTable('strat_strategies');
    await this.loadAdminTable('strat_dimensions');
    await this.loadAdminTable('strat_sub_strategies');
    await this.loadAdminTable('strat_kpis');
    this.adminBuildStratMaps();
    this.adminBuildStratLinks();
    ['strat_links','strat_issues','strat_strategies','strat_dimensions','strat_kpis'].forEach(k => this.renderAdminTable(k));
},

adminBuildStratMaps() {
    const planMap = {};
    const issueMap = {};
    const strategyMap = {};
    const dimMap = {};

    (adminTableState['strat_plans']?.fullData || []).forEach(x => { planMap[x.id] = x.name || x.title || '-'; });
    (adminTableState['strat_issues']?.fullData || []).forEach(x => { issueMap[x.id] = x.name || x.title || '-'; });
    (adminTableState['strat_strategies']?.fullData || []).forEach(x => { strategyMap[x.id] = x.name || x.title || '-'; });
    (adminTableState['strat_dimensions']?.fullData || []).forEach(x => { dimMap[x.id] = x.name || x.title || '-'; });

    adminTableState._planMap = planMap;
    adminTableState._issueMap = issueMap;
    adminTableState._strategyMap = strategyMap;
    adminTableState._dimMap = dimMap;
},

adminBuildStratLinks() {
    // ตารางที่ 2: อ่านจาก strat_links collection โดยตรง
    // saveStratLink เก็บ name ไว้แล้วทุก field ไม่ต้อง join
    const links = adminTableState['strat_links']?.fullData || [];
    const rows = links.map(lnk => ({
        id:              lnk.id,
        _col:            'strat_links',
        _realId:         lnk.id,
        planName:        lnk.planName     || '-',
        issueName:       lnk.issueName    || '-',
        strategyName:    lnk.strategyName || '-',
        dimName:         lnk.dimName      || '-',
        subStrategyName: lnk.subName      || lnk.subStrategyName || '-',
        kpiDimName:      lnk.kpiDimName   || '-',
        name:            lnk.kpiName      || lnk.name || '-',
        createdAt:       lnk.createdAt
    }));
    rows.sort((a,b) => ((a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)));
    const st = this.ensureAdminTableState('strat_links');
    st.fullData = rows;
    if (st.page < 1) st.page = 1;
},

adminFilter(key) {
    const st = this.ensureAdminTableState(key);
    const el = document.getElementById(`adm-search-${key}`);
    st.searchQuery = (el?.value || '').trim().toLowerCase();
    st.page = 1;
    this.renderAdminTable(key);
},

adminPrevPage(key) {
    const st = this.ensureAdminTableState(key);
    if (st.page > 1) st.page -= 1;
    this.renderAdminTable(key);
},

adminNextPage(key) {
    const st = this.ensureAdminTableState(key);
    const total = this.adminGetFilteredData(key).length;
    const maxPage = Math.max(1, Math.ceil(total / st.limit));
    if (st.page < maxPage) st.page += 1;
    this.renderAdminTable(key);
},

adminGetFilteredData(key) {
    const st = this.ensureAdminTableState(key);
    const q = st.searchQuery || '';
    const data = st.fullData || [];
    if (!q) return data;

    return data.filter(x => {
        const text = [
            x.name, x.title, x.deptName, x.parentName, x.note,
            x.planName, x.issueName, x.strategyName, x.dimName,
            x.subStrategyName, x.kpiDimName,
            x.year, x.status
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes(q);
    });
},

adminFmtDate(ts) {
    try {
        if (!ts) return '-';
        if (ts.toDate) ts = ts.toDate();
        const d = (ts instanceof Date) ? ts : new Date(ts);
        if (isNaN(d.getTime())) return '-';
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yy = d.getFullYear();
        return `${dd}/${mm}/${yy}`;
    } catch { return '-'; }
},

renderAdminTable(key) {
    const st = this.ensureAdminTableState(key);
    const tbody = document.getElementById(`adm-tbody-${key}`);
    const pageEl = document.getElementById(`adm-page-${key}`);
    if (!tbody || !pageEl) return;

    const planMap = adminTableState._planMap || {};
    const issueMap = adminTableState._issueMap || {};
    const dimMap = adminTableState._dimMap || {};

    const data = this.adminGetFilteredData(key);
    const total = data.length;
    const maxPage = Math.max(1, Math.ceil(total / st.limit));
    if (st.page > maxPage) st.page = maxPage;

    const start = (st.page - 1) * st.limit;
    const pageData = data.slice(start, start + st.limit);
    pageEl.textContent = `หน้า ${st.page} / ${maxPage}`;

    const iconBtn = (type, onclick) => {
        const cls = type === 'edit'
            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
            : 'bg-rose-50 text-rose-600 hover:bg-rose-100';
        const ic = type === 'edit' ? 'pencil' : 'trash-2';
        return `<button onclick="${onclick}" class="p-2 rounded-lg ${cls} transition-all"><i data-lucide="${ic}" class="w-4 h-4"></i></button>`;
    };

    const col = (txt, cls='') => `<td class="px-6 py-4 ${cls}">${txt ?? '-'}</td>`;
    const colSm = (txt, cls='') => `<td class="px-4 py-3 text-[12px] ${cls}">${txt ?? '-'}</td>`;

    const rows = pageData.map((x, i) => {
        const idx = start + i + 1;
        const name = x.name || x.title || x.year || '-';
        const createdAt = this.adminFmtDate(x.createdAt || x.updatedAt);


        if (key === 'strat_links') {
            return `<tr>
                ${colSm(idx)}
                ${colSm(x.planName        || '-', 'font-bold text-indigo-900')}
                ${colSm(x.issueName       || '-')}
                ${colSm(x.strategyName    || '-')}
                ${colSm(x.dimName         || '-')}
                ${colSm(x.subStrategyName || '-')}
                ${colSm(x.kpiDimName      || '-')}
                ${colSm(x.name            || '-')}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }

        if (key === 'branches') {
            return `<tr>
                ${col(idx)}
                ${col(x.deptName || '-')}
                ${col(name)}
                ${col(createdAt)}
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }


        if (key === 'years') {
            const yearVal = x.year ?? x.name ?? x.title ?? '-';
            const status = x.status ?? x.state ?? '-';
            const note = x.note ?? x.remark ?? '-';
            return `<tr>
                ${colSm(idx)}
                ${colSm(yearVal, 'font-bold text-indigo-900')}
                ${colSm(status)}
                ${colSm(note)}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }

        if (key === 'units') {
            return `<tr>
                ${colSm(idx)}
                ${colSm(name, 'font-bold text-indigo-900')}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }

        if (key === 'strat_issues') {
            return `<tr>
                ${colSm(idx)}
                ${colSm(name, 'font-bold text-indigo-900')}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center"><div class="flex items-center justify-center gap-2">
                    ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                    ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                </div></td></tr>`;
        }

        if (key === 'strat_dimensions') {
            return `<tr>
                ${colSm(idx)}
                ${colSm(name, 'font-bold text-indigo-900')}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center"><div class="flex items-center justify-center gap-2">
                    ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                    ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                </div></td></tr>`;
        }

        if (key === 'strat_kpis' || key === 'strat_kpis_dim' || key === 'strat_kpis_kpi') {
            const badge = x.type === 'kpi'
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-700">ตัวชี้วัด</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">มิติ</span>`;
            const realKey = (key === 'strat_kpis_dim' || key === 'strat_kpis_kpi') ? 'strat_kpis' : key;
            return `<tr>
                ${colSm(idx)}
                ${colSm(name, 'font-bold text-indigo-900')}
                <td class="px-4 py-3">${badge}</td>
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center"><div class="flex items-center justify-center gap-2">
                    ${iconBtn('edit', `App.adminEdit('${realKey}','${x.id}')`)}
                    ${iconBtn('del', `App.adminDelete('${realKey}','${x.id}')`)}
                </div></td></tr>`;
        }

        if (['strat_plans'].includes(key)) {
            const isActive = x.active !== false;
            const badge = isActive
                ? `<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">● ใช้งาน</span>`
                : `<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-400">○ ปิดใช้งาน</span>`;
            const toggleBtn = isActive
                ? `<button onclick="App.adminTogglePlan('${x.id}', false)" title="ปิดใช้งาน" class="p-2 rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"><i data-lucide="toggle-right" class="w-4 h-4"></i></button>`
                : `<button onclick="App.adminTogglePlan('${x.id}', true)" title="เปิดใช้งาน" class="p-2 rounded-lg bg-gray-50 text-gray-400 hover:bg-emerald-50 hover:text-emerald-500 transition-all"><i data-lucide="toggle-left" class="w-4 h-4"></i></button>`;
            return `<tr>
                ${colSm(idx)}
                ${colSm(name)}
                <td class="px-4 py-3">${badge}</td>
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${toggleBtn}
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }

        return `<tr>
            ${col(idx)}
            ${col(name)}
            ${col(createdAt)}
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                    ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                </div>
            </td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rows || `<tr><td class="px-6 py-8 text-center text-gray-300 italic" colspan="10">ไม่มีข้อมูล</td></tr>`;
    lucide.createIcons();
},

adminCloseEditModal() {
    const root = document.getElementById('admin-edit-modal');
    if (!root) return;
    root.className = 'hidden';
    root.innerHTML = '';
    document.body.classList.remove('overflow-hidden');
},

async adminTogglePlan(id, active) {
    try {
        // optimistic: อัปเดต state ทันที แล้ว render เลย
        const st = adminTableState['strat_plans'];
        if (st?.fullData) {
            const row = st.fullData.find(r => r.id === id);
            if (row) row.active = active;
        }
        this.renderAdminTable('strat_plans');

        // Firestore background
        await db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('strat_plans').doc(id)
            .update({ active, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

        // reload dropdowns ทุกที่ที่ใช้ plan
        this._lnkLoadPlans();
    } catch(e) {
        console.error('adminTogglePlan error', e);
        alert('บันทึกไม่สำเร็จ');
        await this.loadAdminTable('strat_plans');
        this.renderAdminTable('strat_plans');
    }
},

adminShowEditModal(innerHtml) {
    const root = document.getElementById('admin-edit-modal');
    if (!root) return;
    root.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    root.innerHTML = `
      <div class="absolute inset-0 bg-black/40" onclick="App.adminCloseEditModal()"></div>
      <div class="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-purple-50 overflow-hidden">
        ${innerHtml}
      </div>
    `;
    document.body.classList.add('overflow-hidden');
    lucide.createIcons();
},

async adminEdit(key, id) {
    try {
        this.showLoader();

        if (key === 'strat_links') {
            // หา row จาก fullData เพื่อดึง _col และ _realId
            const rows  = adminTableState['strat_links']?.fullData || [];
            const row   = rows.find(r => r.id === id);
            if (!row) { alert('ไม่พบข้อมูล'); return; }

            const realCol = row._col   || 'strat_kpis';
            const realId  = row._realId || id;

            // ดึงข้อมูลจริงทุกระดับจาก Firestore เพื่อให้แก้ไขได้ครบ
            const dataRoot = db.collection('artifacts').doc(appId).collection('public').doc('data');

            // โหลด doc ของ level ที่ row นี้ชี้อยู่
            const snap = await this.getAdminColRef(realCol).doc(realId).get();
            const d    = snap.exists ? snap.data() : {};

            // ไล่หา IDs ของทุกระดับจาก row data + doc data
            let planId = '', planName = row.planName && row.planName !== '-' ? row.planName : '';
            let issueId = '', issueName = row.issueName && row.issueName !== '-' ? row.issueName : '';
            let strategyId = '', strategyName = row.strategyName && row.strategyName !== '-' ? row.strategyName : '';
            let dimId = '', dimName = row.dimName && row.dimName !== '-' ? row.dimName : '';
            let subStrategyId = '', subStrategyName = row.subStrategyName && row.subStrategyName !== '-' ? row.subStrategyName : '';
            let kpiDimId = '', kpiDimName = row.kpiDimName && row.kpiDimName !== '-' ? row.kpiDimName : '';
            let kpiName = row.name && row.name !== '-' ? row.name : '';

            // ดึง IDs จาก collection chain ตาม realCol
            if (realCol === 'strat_kpis') {
                // kpi item หรือ kpi dimension
                if (d.type === 'kpi') {
                    kpiName = d.name || kpiName;
                    kpiDimId = d.bscId || '';
                    subStrategyId = d.subStrategyId || '';
                } else {
                    kpiDimName = d.name || kpiDimName;
                    kpiDimId = realId;
                    subStrategyId = d.subStrategyId || '';
                }
                dimId = d.bscId || d.dimId || '';
                strategyId = d.strategyId || '';
                issueId = d.issueId || '';
                planId = d.planId || '';
            } else if (realCol === 'strat_sub_strategies') {
                subStrategyName = d.name || subStrategyName;
                subStrategyId = realId;
                dimId = d.dimId || '';
                strategyId = d.strategyId || '';
                issueId = d.issueId || '';
                planId = d.planId || '';
            } else if (realCol === 'strat_dimensions') {
                dimName = d.name || dimName;
                dimId = realId;
                strategyId = d.strategyId || '';
                issueId = d.issueId || '';
                planId = d.planId || '';
            } else if (realCol === 'strat_strategies') {
                strategyName = d.name || strategyName;
                strategyId = realId;
                issueId = d.issueId || '';
                planId = d.planId || '';
            } else if (realCol === 'strat_issues') {
                issueName = d.name || issueName;
                issueId = realId;
                planId = d.planId || '';
            } else if (realCol === 'strat_plans') {
                planName = d.name || planName;
                planId = realId;
            }

            // ดึงชื่อปัจจุบันจากฐานข้อมูลสำหรับแต่ละระดับที่มี ID
            const fetchName = async (col, docId) => {
                if (!docId) return '';
                try {
                    const s = await dataRoot.collection(col).doc(docId).get();
                    return s.exists ? (s.data().name || '') : '';
                } catch { return ''; }
            };

            if (planId && !planName) planName = await fetchName('strat_plans', planId);
            if (issueId && !issueName) issueName = await fetchName('strat_issues', issueId);
            if (strategyId && !strategyName) strategyName = await fetchName('strat_strategies', strategyId);
            if (dimId && !dimName) dimName = await fetchName('strat_dimensions', dimId);
            if (subStrategyId && !subStrategyName) subStrategyName = await fetchName('strat_sub_strategies', subStrategyId);
            if (kpiDimId && !kpiDimName) kpiDimName = await fetchName('strat_kpis', kpiDimId);

            // helper: always render as editable textarea
            const fieldRow = (label, inputId, value) => `
                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-500">${label}</label>
                    <textarea id="${inputId}" rows="2"
                        class="input-flat w-full bg-white text-sm resize-none"
                        placeholder="ระบุ${label}...">${(value || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
                </div>`;

            this.adminShowEditModal(`
                <div class="px-8 py-6 border-b border-gray-100 flex items-start justify-between">
                    <div>
                        <div class="text-xs font-bold text-purple-600 mb-1">แก้ไขข้อมูล — แผนพัฒนามหาวิทยาลัยฯ และความเชื่อมโยง</div>
                        <div class="text-lg font-black text-gray-800">แก้ไขทุกระดับในแถวนี้</div>
                        <div class="text-xs text-gray-400 mt-1">แก้ไขชื่อได้ทุกช่อง แล้วกด "บันทึก"</div>
                    </div>
                    <button onclick="App.adminCloseEditModal()" class="h-9 w-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
                    <input type="hidden" id="adm-edit-strat-realcol"    value="${realCol}">
                    <input type="hidden" id="adm-edit-strat-realid"     value="${realId}">
                    <input type="hidden" id="adm-edit-strat-planid"     value="${planId}">
                    <input type="hidden" id="adm-edit-strat-issueid"    value="${issueId}">
                    <input type="hidden" id="adm-edit-strat-strategyid" value="${strategyId}">
                    <input type="hidden" id="adm-edit-strat-dimid"      value="${dimId}">
                    <input type="hidden" id="adm-edit-strat-substratid" value="${subStrategyId}">
                    <input type="hidden" id="adm-edit-strat-kpidimid"   value="${kpiDimId}">
                    <input type="hidden" id="adm-edit-strat-kpitype"    value="${d.type || ''}">

                    ${fieldRow('ฉบับแผน', 'adm-edit-strat-plan', planName)}
                    ${fieldRow('ประเด็นยุทธศาสตร์', 'adm-edit-strat-issue', issueName)}
                    ${fieldRow('วัตถุประสงค์เชิงยุทธศาสตร์', 'adm-edit-strat-strategy', strategyName)}
                    ${fieldRow('กลยุทธ์', 'adm-edit-strat-dim', dimName)}
                    ${fieldRow('กลยุทธ์ย่อย', 'adm-edit-strat-substrat', subStrategyName)}
                    ${fieldRow('มิติ', 'adm-edit-strat-kpidim', kpiDimName)}
                    ${fieldRow('ตัวชี้วัด', 'adm-edit-strat-kpi', kpiName)}

                    <div class="flex justify-end gap-3 pt-2">
                        <button onclick="App.adminCloseEditModal()"
                            class="h-[42px] px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm">ยกเลิก</button>
                        <button onclick="App.adminSaveStratEdit()"
                            class="h-[42px] px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md flex items-center gap-2">
                            <i data-lucide="check-circle" class="w-4 h-4"></i> บันทึก
                        </button>
                    </div>
                </div>
            `);
            return;
        }

        // default: simple name edit for other collections
        const snap = await this.getAdminColRef(key).doc(id).get();
        const d    = snap.exists ? snap.data() : {};
        this.adminShowEditModal(`
            <div class="px-8 py-6 border-b border-gray-100 flex items-start justify-between">
                <div class="text-lg font-black text-gray-800">แก้ไขข้อมูล</div>
                <button onclick="App.adminCloseEditModal()" class="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="p-8 space-y-5">
                <input type="hidden" id="adm-edit-key" value="${key}">
                <input type="hidden" id="adm-edit-id"  value="${id}">
                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-500">ชื่อ</label>
                    <input id="adm-edit-name" class="input-flat w-full bg-white text-sm"
                        value="${(d.name || '').replace(/"/g,'&quot;')}" placeholder="ระบุชื่อ...">
                </div>
                <div class="flex justify-end gap-3 pt-2">
                    <button onclick="App.adminCloseEditModal()"
                        class="h-[42px] px-6 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm">ยกเลิก</button>
                    <button onclick="App.adminModalSave(document.getElementById('adm-edit-key').value, document.getElementById('adm-edit-id').value)"
                        class="h-[42px] px-6 rounded-xl bg-purple-600 text-white font-bold text-sm shadow-md flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-4 h-4"></i> บันทึก
                    </button>
                </div>
            </div>
        `);
    } catch (e) {
        console.error('adminEdit error', e);
        alert('เปิดฟอร์มแก้ไขไม่สำเร็จ');
    } finally {
        this.hideLoader();
    }
},

async adminSaveStratEdit() {
    try {
        const sv = (eid) => document.getElementById(eid)?.value?.trim() || '';

        let realCol    = sv('adm-edit-strat-realcol');
        let realId     = sv('adm-edit-strat-realid');
        let planId     = sv('adm-edit-strat-planid');
        let issueId    = sv('adm-edit-strat-issueid');
        let strategyId = sv('adm-edit-strat-strategyid');
        let dimId      = sv('adm-edit-strat-dimid');
        let subStratId = sv('adm-edit-strat-substratid');
        let kpiDimId   = sv('adm-edit-strat-kpidimid');
        const kpiType  = sv('adm-edit-strat-kpitype');

        const planName     = sv('adm-edit-strat-plan');
        const issueName    = sv('adm-edit-strat-issue');
        const strategyName = sv('adm-edit-strat-strategy');
        const dimName      = sv('adm-edit-strat-dim');
        const subStratName = sv('adm-edit-strat-substrat');
        const kpiDimName   = sv('adm-edit-strat-kpidim');
        const kpiName      = sv('adm-edit-strat-kpi');

        if (!realCol) return alert('ไม่พบข้อมูล');

        this.showLoader();

        const now      = firebase.firestore.FieldValue.serverTimestamp();
        const ts       = { createdAt: now, createdBy: currentUser?.name || '' };
        const dataRoot = db.collection('artifacts').doc(appId).collection('public').doc('data');

        // helper: update existing or create new doc, returns the id used
        const upsert = async (col, docId, payload) => {
            if (docId) {
                await dataRoot.collection(col).doc(docId).set({ ...payload, updatedAt: now }, { merge: true });
                return docId;
            } else if (payload.name) {
                const ref = await dataRoot.collection(col).add({ ...payload, ...ts });
                return ref.id;
            }
            return '';
        };

        // save/create each level top-down so child can reference parent id
        planId     = await upsert('strat_plans',          planId,     planName     ? { name: planName }                                    : {});
        issueId    = await upsert('strat_issues',         issueId,    issueName    ? { name: issueName,    planId }                        : {});
        strategyId = await upsert('strat_strategies',     strategyId, strategyName ? { name: strategyName, issueId, planId }               : {});
        dimId      = await upsert('strat_dimensions',     dimId,      dimName      ? { name: dimName,      strategyId, issueId, planId }    : {});
        subStratId = await upsert('strat_sub_strategies', subStratId, subStratName ? { name: subStratName, dimId, strategyId, issueId, planId } : {});
        kpiDimId   = await upsert('strat_kpis',           kpiDimId,   kpiDimName   ? { name: kpiDimName,   type: 'dimension', subStrategyId: subStratId, bscId: dimId, strategyId, issueId, planId } : {});

        // ตัวชี้วัด (type=kpi)
        if (kpiName) {
            const kpiDocId = (kpiType === 'kpi' && realId) ? realId : '';
            await upsert('strat_kpis', kpiDocId, { name: kpiName, type: 'kpi', bscId: kpiDimId, subStrategyId: subStratId, dimId, strategyId, issueId, planId });
        }

        alert('บันทึกสำเร็จ');
        this.adminCloseEditModal();
        await this.refreshAdminStratLinks();
        this.renderAdminTable('strat_links');
    } catch (e) {
        console.error('adminSaveStratEdit error', e);
        alert('บันทึกไม่สำเร็จ: ' + e.message);
    } finally {
        this.hideLoader();
    }
},

adminModalSetIssueOptions(planId, selectedIssueId) {
    const issues = adminTableState['strat_issues']?.fullData || [];
    const sel = document.getElementById('adm-edit-issue');
    if (!sel) return;
    const rows = issues.filter(x => (x.planId || x.parentId || '') === planId);
    sel.innerHTML = rows.map(r => `<option value="${r.id}">${r.name || r.title || '-'}</option>`).join('');
    if (selectedIssueId && rows.some(r => r.id === selectedIssueId)) sel.value = selectedIssueId;
},

adminModalSetDimOptions(issueId, selectedDimId) {
    const dims = adminTableState['strat_dimensions']?.fullData || [];
    const sel = document.getElementById('adm-edit-dim');
    if (!sel) return;
    // schema ใหม่: dimension ผูกกับ strategyId เป็นหลัก (schema เก่าอาจมี issueId)
    const rows = dims.filter(x => (x.strategyId || x.stratStrategyId || x.issueId || x.parentId || '') === issueId);
    sel.innerHTML = rows.map(r => `<option value="${r.id}">${r.name || r.title || '-'}</option>`).join('');
    if (selectedDimId && rows.some(r => r.id === selectedDimId)) sel.value = selectedDimId;
},

async adminModalSave(key, id) {
    (async () => {
        try {
            const sv = (eid) => (document.getElementById(eid)?.value ?? '');
            if (!db) return alert('Firebase Error');

            if (key === 'years') {
                const year = sv('adm-edit-year').trim();
                const status = sv('adm-edit-status').trim();
                const note = sv('adm-edit-note').trim();
                if (!year) return alert('โปรดระบุปี พ.ศ.');

                await this.getAdminColRef('years').doc(id).update({
                    year,
                    name: String(year),
                    status: status || '',
                    note: note || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                alert('บันทึกสำเร็จ');
                await this.loadAdminTable('years');
                this.renderAdminTable('years');
                this.adminCloseEditModal();
                return;
            }

            if (key === 'branches') {
                const deptId = sv('adm-edit-dept');
                const deptName = document.getElementById('adm-edit-dept')?.selectedOptions?.[0]?.textContent?.trim() || '';
                const name = sv('adm-edit-name').trim();
                if (!deptId) return alert('โปรดเลือกหน่วยงาน');
                if (!name) return alert('โปรดระบุสาขา/งาน');

                await this.getAdminColRef('branches').doc(id).update({
                    deptId,
                    deptName,
                    name,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                alert('บันทึกสำเร็จ');
                await this.loadAdminTable('branches');
                this.renderAdminTable('branches');
                this.adminCloseEditModal();
                return;
            }

            if (key === 'strat_links') {
                // แก้ไขชื่อทุกระดับ แล้วบันทึกลงฐานข้อมูลจริง
                const planName = sv('adm-edit-plan-name').trim();
                const issueName = sv('adm-edit-issue-name').trim();
                const strategyName = sv('adm-edit-strategy-name').trim();
                const dimName = sv('adm-edit-dim-name').trim();
                const kpiName = sv('adm-edit-kpi-name').trim();

                const kpiRef = this.getAdminColRef('strat_kpis').doc(id);
                const kpiSnap = await kpiRef.get();
                if (!kpiSnap.exists) return alert('ไม่พบข้อมูลตัวชี้วัด');
                const kpiDoc = { id: kpiSnap.id, ...kpiSnap.data() };

                const dimId = kpiDoc.bscId || kpiDoc.dimId || kpiDoc.parentId || '';
                const dimRef = this.getAdminColRef('strat_dimensions').doc(dimId);
                const dimSnap = dimId ? await dimRef.get() : null;
                const dimDoc = (dimSnap && dimSnap.exists) ? { id: dimSnap.id, ...dimSnap.data() } : {};

                const strategyId = dimDoc.strategyId || dimDoc.stratStrategyId || '';
                const stratRef = this.getAdminColRef('strat_strategies').doc(strategyId);
                const stratSnap = strategyId ? await stratRef.get() : null;
                const stratDoc = (stratSnap && stratSnap.exists) ? { id: stratSnap.id, ...stratSnap.data() } : {};

                const issueId = stratDoc.issueId || stratDoc.stratIssueId || dimDoc.issueId || dimDoc.stratIssueId || dimDoc.parentId || '';
                const issueRef = this.getAdminColRef('strat_issues').doc(issueId);
                const issueSnap = issueId ? await issueRef.get() : null;
                const issueDoc = (issueSnap && issueSnap.exists) ? { id: issueSnap.id, ...issueSnap.data() } : {};

                const planId = issueDoc.planId || issueDoc.stratPlanId || issueDoc.parentId || '';
                const planRef = this.getAdminColRef('strat_plans').doc(planId);

                const now = firebase.firestore.FieldValue.serverTimestamp();
                const batch = db.batch();

                if (planId && planName) batch.update(planRef, { name: planName, updatedAt: now });
                if (issueId && issueName) batch.update(issueRef, { name: issueName, updatedAt: now });
                if (strategyId && strategyName) batch.update(stratRef, { name: strategyName, updatedAt: now });
                if (dimId && dimName) batch.update(dimRef, { name: dimName, updatedAt: now });
                if (kpiName) batch.update(kpiRef, { name: kpiName, updatedAt: now });

                await batch.commit();

                alert('บันทึกสำเร็จ');
                await this.refreshAdminStratLinks();
                this.adminCloseEditModal();
                return;
            }

            // default (ชื่อเดียว)
            const name = sv('adm-edit-name').trim();
            if (!name) return alert('โปรดระบุข้อมูล');

            await this.getAdminColRef(key).doc(id).update({
                name,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('บันทึกสำเร็จ');
            await this.loadAdminTable(key);
            this.renderAdminTable(key);
            this.adminCloseEditModal();
        } catch (e) {
            console.error('adminModalSave error', e);
            alert('บันทึกไม่สำเร็จ');
        }
    })();
},

async adminDelete(key, id) {
    try {
        if (key !== 'strat_links') {
            // ─── non-strat_links: original logic ───────────────────────
            const ok = confirm('ยืนยันลบข้อมูลนี้?');
            if (!ok) return;
            this.showLoader();
            await this.getAdminColRef(key).doc(id).delete();
            if (['strat_plans','strat_issues','strat_strategies','strat_dimensions','strat_kpis'].includes(key)) {
                await this.refreshAdminStratLinks();
                this.adminResetStratLinkingUI();
            } else {
                await this.loadAdminTable(key);
                this.renderAdminTable(key);
            }
            return;
        }

        // ─── strat_links: full-chain delete with in-use guard ──────────
        const rows = adminTableState['strat_links']?.fullData || [];
        const row  = rows.find(r => r.id === id);
        if (!row) { alert('ไม่พบข้อมูล'); return; }

        // collect all IDs in this row's chain
        const chainIds = {
            planId:      row._planId      || (row._col === 'strat_plans'          ? row._realId : ''),
            issueId:     row._issueId     || (row._col === 'strat_issues'         ? row._realId : ''),
            strategyId:  row._strategyId  || (row._col === 'strat_strategies'     ? row._realId : ''),
            dimId:       row._dimId       || (row._col === 'strat_dimensions'     ? row._realId : ''),
            subStratId:  row._subStratId  || (row._col === 'strat_sub_strategies' ? row._realId : ''),
            kpiDimId:    row._kpiDimId    || (row._col === 'strat_kpis' && row._kpiType !== 'kpi' ? row._realId : ''),
            kpiItemId:   row._col === 'strat_kpis' && row._kpiType === 'kpi' ? row._realId : '',
        };

        // re-fetch the actual doc to get correct parent IDs
        this.showLoader();
        const docSnap = await this.getAdminColRef(row._col).doc(row._realId).get();
        if (docSnap.exists) {
            const d = docSnap.data();
            if (row._col === 'strat_kpis') {
                if (d.type === 'kpi') {
                    chainIds.kpiItemId = row._realId;
                    chainIds.kpiDimId  = d.bscId || '';
                } else {
                    chainIds.kpiDimId = row._realId;
                }
                chainIds.subStratId  = chainIds.subStratId  || d.subStrategyId || '';
                chainIds.dimId       = chainIds.dimId       || d.bscId || d.dimId || '';
                chainIds.strategyId  = chainIds.strategyId  || d.strategyId || '';
                chainIds.issueId     = chainIds.issueId     || d.issueId || '';
                chainIds.planId      = chainIds.planId      || d.planId || '';
            } else if (row._col === 'strat_sub_strategies') {
                chainIds.subStratId = row._realId;
                chainIds.dimId      = chainIds.dimId     || d.dimId || '';
                chainIds.strategyId = chainIds.strategyId|| d.strategyId || '';
                chainIds.issueId    = chainIds.issueId   || d.issueId || '';
                chainIds.planId     = chainIds.planId    || d.planId || '';
            } else if (row._col === 'strat_dimensions') {
                chainIds.dimId      = row._realId;
                chainIds.strategyId = chainIds.strategyId || d.strategyId || '';
                chainIds.issueId    = chainIds.issueId   || d.issueId || '';
                chainIds.planId     = chainIds.planId    || d.planId || '';
            } else if (row._col === 'strat_strategies') {
                chainIds.strategyId = row._realId;
                chainIds.issueId    = chainIds.issueId || d.issueId || '';
                chainIds.planId     = chainIds.planId  || d.planId || '';
            } else if (row._col === 'strat_issues') {
                chainIds.issueId = row._realId;
                chainIds.planId  = chainIds.planId || d.planId || '';
            } else if (row._col === 'strat_plans') {
                chainIds.planId = row._realId;
            }
        }

        // check if any form4 doc references IDs in this chain
        const form4Col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('form4');
        const refFields = [
            { field: 'plan',      id: chainIds.planId },
            { field: 'issue',     id: chainIds.issueId },
            { field: 'strategy',  id: chainIds.strategyId },
            { field: 'dimension', id: chainIds.dimId },
        ];
        let isUsed = false;
        for (const ref of refFields) {
            if (!ref.id) continue;
            const chk = await form4Col.where(ref.field, '==', ref.id).limit(1).get();
            if (!chk.empty) { isUsed = true; break; }
        }

        this.hideLoader();

        if (isUsed) {
            alert('⚠️ มีการใช้ข้อมูลในการเชื่อมโยงในส่วนอื่นๆ\nหากลบจะทำให้ข้อมูลหาย\nไม่สามารถลบได้');
            return;
        }

        const ok = confirm('ยืนยันลบข้อมูลแถวนี้ทั้งหมด?');
        if (!ok) return;

        // delete entire chain for this row
        this.showLoader();
        const dataRoot = db.collection('artifacts').doc(appId).collection('public').doc('data');
        const batch = db.batch();

        const safeDelete = (col, docId) => {
            if (docId) batch.delete(dataRoot.collection(col).doc(docId));
        };

        safeDelete('strat_kpis',           chainIds.kpiItemId);
        safeDelete('strat_kpis',           chainIds.kpiDimId);
        safeDelete('strat_sub_strategies', chainIds.subStratId);
        safeDelete('strat_dimensions',     chainIds.dimId);
        safeDelete('strat_strategies',     chainIds.strategyId);
        safeDelete('strat_issues',         chainIds.issueId);
        safeDelete('strat_plans',          chainIds.planId);

        await batch.commit();
        await this.refreshAdminStratLinks();
        this.adminResetStratLinkingUI();
        this.renderAdminTable('strat_links');

    } catch (e) {
        console.error('adminDelete error', e);
        alert('ลบไม่สำเร็จ');
    } finally {
        this.hideLoader();
    }
},


async fillDeptSelectForBranches() {
    try {
        const sel = document.getElementById('m-dept-select');
        if (!sel) return;
        const snap = await this.getAdminColRef('depts').orderBy('name').get();
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        sel.innerHTML = rows.map(r => `<option value="${r.id}">${r.name || '-'}</option>`).join('');
    } catch (e) {
        console.error("fillDeptSelectForBranches error", e);
    }
},

    // ฟังก์ชันเดิมของโครงสร้างองค์กร
    async saveBranch() {
    const deptId = document.getElementById('m-dept-select')?.value;
    const deptName = document.getElementById('m-dept-select')?.selectedOptions?.[0]?.textContent?.trim() || '';
    const name = document.getElementById('m-branch-name')?.value?.trim();

    if (!deptId) return alert('โปรดเลือกหน่วยงาน');
    if (!name) return alert('โปรดระบุสาขา/งาน');

    this.showLoader();
    this.getAdminColRef('branches').add({
        deptId,
        deptName,
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('m-branch-name').value = '';
        this.loadAdminTable('branches');
        alert('เชื่อมโยงสำเร็จ');
    }).catch(err => {
        console.error(err);
        alert('บันทึกไม่สำเร็จ');
    }).finally(() => this.hideLoader());
},


    async loadMasterTable() {
        const tbody = document.getElementById('master-table-body');
        if (!tbody) return;
        tableState.currentType = document.getElementById('search-table-sel').value;
        this.showLoader();
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection(tableState.currentType).orderBy('createdAt', 'desc').get();
        tableState.fullData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.renderTableBody();
        this.hideLoader();
    },

    renderTableBody() {
        const tbody = document.getElementById('master-table-body');
        const query = tableState.searchQuery.toLowerCase();
        const filtered = tableState.fullData.filter(item => (item.name || "").toLowerCase().includes(query));
        const start = (tableState.page - 1) * tableState.limit;
        const pagedData = filtered.slice(start, start + tableState.limit);
        document.getElementById('table-page-info').innerText = `หน้า ${tableState.page}`;
        tbody.innerHTML = pagedData.map(doc => `<tr class="hover:bg-purple-50/50"><td class="px-8 py-4 font-bold">${doc.name}</td><td class="px-8 py-4 text-right group"><div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all"><button class="p-2 text-yellow-500"><i data-lucide="edit-3" size="14"></i></button><button class="p-2 text-red-500"><i data-lucide="trash-2" size="14"></i></button></div></td></tr>`).join('');
        lucide.createIcons();
    },

    // --- User Ops ---
    async saveUser() {
        const editId = document.getElementById('u-edit-id')?.value?.trim();
        const userData = {
            username: document.getElementById('u-user').value.trim(),
            password: document.getElementById('u-pass').value.trim(),
            fullname: document.getElementById('u-fullname').value.trim(),
            role: document.getElementById('u-role').value,
            position: document.getElementById('u-pos').value.trim(),
            dept: document.getElementById('u-dept-select').value
        };

        if (!userData.username || !userData.password) return alert("กรอกข้อมูลสำคัญด้วยจ้า");

        this.showLoader();
        const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
        try {
            if (editId) {
                await col.doc(editId).set({
                    ...userData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } else {
                await col.add({
                    ...userData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            this.resetUserForm();
            await this.loadUserTable();
        } finally {
            this.hideLoader();
        }
    },

    async loadUserTable() {
        const tbody = document.getElementById('user-list-body');
        if (!tbody) return;
        this.showLoader();
        const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
        const snap = await col.orderBy('createdAt', 'desc').get().catch(async () => {
            // เผื่อบางเอกสารยังไม่มี createdAt
            return await col.get();
        });

        const iconBtn = (type, onclick) => {
            const cls = type === 'edit'
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'bg-rose-50 text-rose-600 hover:bg-rose-100';
            const ic = type === 'edit' ? 'pencil' : 'trash-2';
            return `<button onclick="${onclick}" class="p-2 rounded-lg ${cls} transition-all"><i data-lucide="${ic}" class="w-4 h-4"></i></button>`;
        };

        tbody.innerHTML = snap.docs.map(doc => {
            const d = doc.data() || {};
            const createdAt = this.adminFmtDate(d.createdAt || d.updatedAt);
            return `
            <tr class="hover:bg-purple-50/30 transition-all">
                <td class="px-6 py-4 font-bold text-indigo-600">${d.username || '-'}</td>
                <td class="px-6 py-4 font-mono text-purple-700 tracking-wider">${d.password || '-'}</td> 
                <td class="px-6 py-4">${d.fullname || '-'}</td>
                <td class="px-6 py-4 text-center"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold">${d.role || '-'}</span></td>
                <td class="px-6 py-4">${d.position || '-'}</td>
                <td class="px-6 py-4">${d.dept || '-'}</td>
                <td class="px-6 py-4">${createdAt}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex justify-center gap-2">
                        ${iconBtn('edit', `App.openUserEditModal('${doc.id}')`)}
                        ${iconBtn('del', `App.deleteUser('${doc.id}')`)}
                    </div>
                </td>
            </tr>`;
        }).join('');
        lucide.createIcons();
        this.hideLoader();
    },

    // --- User Edit Modal ---
    async openUserEditModal(id) {
        try {
            const modalRoot = document.getElementById('user-edit-modal');
            if (!modalRoot) return alert('ไม่พบพื้นที่แสดงฟอร์มแก้ไข');

            const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
            const doc = await col.doc(id).get();
            if (!doc.exists) return alert('ไม่พบข้อมูลผู้ใช้งาน');
            const d = doc.data() || {};

            // สร้างตัวเลือกหน่วยงานจาก select หลัก (ซิงค์ให้เหมือนกัน)
            const deptSel = document.getElementById('u-dept-select');
            const deptOptions = deptSel ? deptSel.innerHTML : '<option value="">เลือกหน่วยงาน</option>';

            modalRoot.innerHTML = `
            <div class="fixed inset-0 z-[999] flex items-center justify-center">
                <div class="absolute inset-0 bg-black/40" onclick="App.closeUserEditModal()"></div>
                <div class="relative w-[92vw] max-w-3xl bg-white rounded-[2rem] shadow-2xl border border-purple-100 overflow-hidden">
                    <div class="px-8 py-6 border-b border-gray-100 flex items-start justify-between">
                        <div>
                            <div class="text-sm font-bold text-purple-600">แก้ไขข้อมูล</div>
                            <div class="text-2xl font-black text-gray-800">แก้ไขผู้ใช้งานระบบ</div>
                            <div class="text-xs text-gray-500 mt-1">แก้ไขได้ทุกช่อง แล้วกดบันทึกเพื่ออัปเดตฐานข้อมูลจริง</div>
                        </div>
                        <button class="h-10 w-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center" onclick="App.closeUserEditModal()"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <div class="p-8">
                        <input type="hidden" id="um-id" value="${id}">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-bold text-gray-500 ml-1">Username</label>
                                <input id="um-user" class="input-flat w-full bg-white" value="${(d.username||'').replace(/"/g,'&quot;')}" placeholder="ระบุชื่อผู้ใช้">
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-bold text-gray-500 ml-1">Password</label>
                                <input id="um-pass" class="input-flat w-full bg-white" value="${(d.password||'').replace(/"/g,'&quot;')}" placeholder="ระบุรหัสผ่าน">
                            </div>
                            <div class="space-y-1.5 md:col-span-2">
                                <label class="text-[11px] font-bold text-gray-500 ml-1">ชื่อ-นามสกุล</label>
                                <input id="um-fullname" class="input-flat w-full bg-white" value="${(d.fullname||'').replace(/"/g,'&quot;')}" placeholder="ระบุชื่อ-สกุล">
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-bold text-gray-500 ml-1">สิทธิ์การใช้งาน</label>
                                <select id="um-role" class="input-flat w-full bg-white font-bold">
                                    <option value="admin">ผู้ดูแลระบบ</option>
                                    <option value="manager">ผู้บริหาร</option>
                                    <option value="staff_central">เจ้าหน้าที่ส่วนกลาง</option>
                                    <option value="staff_dept">เจ้าหน้าที่หน่วยงาน</option>
                                </select>
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-bold text-gray-500 ml-1">ตำแหน่ง</label>
                                <input id="um-pos" class="input-flat w-full bg-white" value="${(d.position||'').replace(/"/g,'&quot;')}" placeholder="ระบุตำแหน่ง">
                            </div>
                            <div class="space-y-1.5 md:col-span-2">
                                <label class="text-[11px] font-bold text-gray-500 ml-1">หน่วยงาน</label>
                                <select id="um-dept" class="input-flat w-full bg-white font-bold">${deptOptions}</select>
                            </div>
                        </div>
                        <div class="mt-8 flex justify-end gap-3">
                            <button class="h-[42px] px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold" onclick="App.closeUserEditModal()">ยกเลิก</button>
                            <button class="h-[42px] px-6 rounded-xl bg-[#10b981] hover:bg-green-600 text-white font-bold shadow-md flex items-center gap-2" onclick="App.saveUserEditModal()"><i data-lucide="check-circle" class="w-5 h-5"></i> บันทึก</button>
                        </div>
                    </div>
                </div>
            </div>`;

            modalRoot.classList.remove('hidden');
            // set selected values
            const roleSel = document.getElementById('um-role');
            if (roleSel) roleSel.value = d.role || 'staff_dept';
            const deptSel2 = document.getElementById('um-dept');
            if (deptSel2) deptSel2.value = d.dept || '';
            lucide.createIcons();
        } catch (e) {
            console.error('openUserEditModal error', e);
            alert('เปิดฟอร์มแก้ไขไม่สำเร็จ');
        }
    },

    closeUserEditModal() {
        const modalRoot = document.getElementById('user-edit-modal');
        if (!modalRoot) return;
        modalRoot.classList.add('hidden');
        modalRoot.innerHTML = '';
    },

    async saveUserEditModal() {
        const id = document.getElementById('um-id')?.value?.trim();
        if (!id) return alert('ไม่พบรหัสผู้ใช้งาน');
        const userData = {
            username: document.getElementById('um-user')?.value?.trim() || '',
            password: document.getElementById('um-pass')?.value?.trim() || '',
            fullname: document.getElementById('um-fullname')?.value?.trim() || '',
            role: document.getElementById('um-role')?.value || 'staff_dept',
            position: document.getElementById('um-pos')?.value?.trim() || '',
            dept: document.getElementById('um-dept')?.value || ''
        };
        if (!userData.username || !userData.password) return alert('กรอก Username และ Password ด้วยจ้า');

        this.showLoader();
        try {
            const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
            await col.doc(id).set({
                ...userData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            this.closeUserEditModal();
            await this.loadUserTable();
        } catch (e) {
            console.error('saveUserEditModal error', e);
            alert('บันทึกการแก้ไขไม่สำเร็จ');
        } finally {
            this.hideLoader();
        }
    },

    // คงชื่อเดิมไว้เผื่อมีที่เรียกใช้อยู่
    async editUser(id) { return this.openUserEditModal(id); },

    async deleteUser(id) {
        try {
            const ok = confirm('ยืนยันลบผู้ใช้งานนี้?');
            if (!ok) return;
            const col = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
            await col.doc(id).delete();
            await this.loadUserTable();
            // ถ้าลบตัวที่กำลังแก้ไขอยู่ให้เคลียร์ฟอร์ม
            if (document.getElementById('u-edit-id')?.value === id) this.resetUserForm();
        } catch (e) {
            console.error('deleteUser error', e);
            alert('ลบไม่สำเร็จ');
        }
    },

    // --- Helpers ---
    filterTableData() { tableState.searchQuery = document.getElementById('table-search-input').value; tableState.page = 1; this.renderTableBody(); },
    prevTablePage() { if (tableState.page > 1) { tableState.page--; this.renderTableBody(); } },
    nextTablePage() { if (tableState.page * tableState.limit < tableState.fullData.length) { tableState.page++; this.renderTableBody(); } },
    async fillUserDeptSelect() {
        const sel = document.getElementById('u-dept-select');
        if (!sel) return;
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('depts').get();
        sel.innerHTML = '<option value="">เลือกหน่วยงาน</option>' + snap.docs.map(doc => `<option value="${doc.data().name}">${doc.data().name}</option>`).join('');
    },
    resetUserForm() {
        document.getElementById('u-edit-id').value = "";
        document.getElementById('u-user').value = "";
        document.getElementById('u-pass').value = "";
        document.getElementById('u-fullname').value = "";
        const role = document.getElementById('u-role');
        if (role) role.value = 'admin';
        const pos = document.getElementById('u-pos');
        if (pos) pos.value = "";
        const dept = document.getElementById('u-dept-select');
        if (dept) dept.value = "";
        const btn = document.getElementById('btn-save-user');
        if (btn) btn.innerHTML = '<i data-lucide="check-circle" size="18"></i> บันทึก';
        lucide.createIcons();
    },
    showLoader() { document.getElementById('loader').classList.remove('hidden'); },
    hideLoader() { document.getElementById('loader').classList.add('hidden'); },
    doPrint() { window.scrollTo({ top: 0 }); setTimeout(() => window.print(), 120); },

    /* ============================================================
       (ง.6) แบบเสนอขอโครงการ — รวมเข้ากับ App object
       ============================================================ */


    /* ---------- INIT ---------- */
    f6LoadBranches() {
        const deptEl = document.getElementById('f6-dept');
        const branchEl = document.getElementById('f6-branch');
        if (!deptEl || !branchEl) return;
        const deptId = deptEl.value;
        if (!deptId) {
            branchEl.innerHTML = '<option value="">— เลือกหน่วยงานก่อน —</option>';
            return;
        }
        const branches = (this._f6cache?.branches || []).filter(b => b.deptId === deptId);
        branchEl.innerHTML = `<option value="">${branches.length ? '— เลือกสาขา/งาน —' : '— ไม่มีสาขา/งานในหน่วยงานนี้ —'}</option>` +
            branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    },

    async initManageForm6() {
        if (!document.getElementById('f6-dept')) return;

        const setOptions = (sel, items, placeholder = 'โปรดระบุ ...') => {
            if (!sel) return;
            const clone = sel.cloneNode(false);
            clone.onchange = sel.onchange;
            const empty = document.createElement('option');
            empty.value = '';
            empty.textContent = items.length ? placeholder : '— ยังไม่มีข้อมูล —';
            clone.appendChild(empty);
            for (const x of items) {
                const opt = document.createElement('option');
                opt.value = (x.value ?? x.id ?? '').toString();
                opt.textContent = (x.label ?? x.name ?? x.value ?? '').toString();
                clone.appendChild(opt);
            }
            clone.disabled = items.length === 0;
            const syncTint = () => clone.value
                ? clone.classList.remove('f4-placeholder')
                : clone.classList.add('f4-placeholder');
            clone.addEventListener('change', syncTint);
            syncTint();
            sel.replaceWith(clone);
        };

        const getCol = (name) => db.collection('artifacts').doc(appId)
            .collection('public').doc('data').collection(name);

        try {
            this.showLoader();

            const [depts, branches, years, issues, strategies, dimensions, units] = await Promise.all([
                getCol('depts').orderBy('name').get(),
                getCol('branches').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('years').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_issues').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_strategies').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('strat_dimensions').orderBy('name').get().catch(() => ({ docs: [] })),
                getCol('units').orderBy('name').get().catch(() => ({ docs: [] })),
            ]);

            const mapDocs = (snap) => (snap?.docs || []).map(d => ({ id: d.id, ...d.data() }));

            const cache = this._f6cache = {
                depts:      mapDocs(depts),
                branches:   mapDocs(branches),
                years:      mapDocs(years),
                issues:     mapDocs(issues),
                strategies: mapDocs(strategies),
                dimensions: mapDocs(dimensions),
                units:      mapDocs(units),
            };

            setOptions(document.getElementById('f6-dept'),   cache.depts);
            // สาขา/งาน: รีเซ็ตรอให้ผู้ใช้เลือก dept ก่อน
            const f6BranchEl = document.getElementById('f6-branch');
            if (f6BranchEl) f6BranchEl.innerHTML = '<option value="">— เลือกหน่วยงานก่อน —</option>';
            setOptions(document.getElementById('f6-year'),   cache.years);
            setOptions(document.getElementById('f6-issue'),  cache.issues, '— เลือกประเด็นยุทธศาสตร์ —');

            // ตั้งต้น: เพิ่มแถวเริ่มต้นอย่างน้อย 1 แถวในตารางแบบไดนามิกทุกตัว ถ้ายังไม่มี
            ['compensation', 'service', 'material'].forEach(key => {
                const body = document.getElementById(`f6-budget-${key}-rows`);
                if (body && !body.children.length) this.f6AddBudgetRow(key);
            });
            ['plan13', 'project'].forEach(key => {
                const body = document.getElementById(`f6-kpi-${key}-rows`);
                if (body && !body.children.length) this.f6AddKpiRow(key);
            });
            const actBody = document.getElementById('f6-activity-rows');
            if (actBody && !actBody.children.length) {
                ['การวางแผนปฏิบัติงาน', 'การดำเนินงาน', 'การติดตามและการประเมินผล']
                    .forEach(label => this.f6AddActivityRow(label));
            }

            // ถ้ามี id ที่กำลังแก้ไข ให้โหลดข้อมูลกลับเข้าฟอร์ม (รองรับเรียกซ้ำตอนแก้ไข)
            const editId = document.getElementById('f6-edit-id')?.value;
            if (editId) await this.loadForm6ToForm(editId);

            await this.loadForm6Records();

        } catch (e) {
            console.error('initManageForm6 error', e);
        } finally {
            this.hideLoader();
            lucide.createIcons();
        }
    },

    /* ---------- ข้อ 2: ลักษณะโครงการ "อื่นๆ" toggle ---------- */
    f6ToggleNatureOther() {
        const el = document.getElementById('f6-nature-7'); // index 7 = อื่นๆ
        const txt = document.getElementById('f6-nature-other-text');
        if (el && txt) txt.classList.toggle('hidden', !el.checked);
    },

    /* ---------- ข้อ 3: แหล่งงบประมาณ radio toggle (ไม่ต้องทำอะไรเพิ่ม เก็บตอน save) ---------- */
    f6ToggleBudgetSrc() { /* no-op, รองรับ event hook ในอนาคต */ },

    /* ---------- SECTION C: cascade ประเด็นยุทธศาสตร์ -> วัตถุประสงค์ -> กลยุทธ์ ---------- */
    f6CascadeStep(step) {
        const cache = this._f6cache || {};
        if (step === 'issue') {
            const issueId = document.getElementById('f6-issue')?.value || '';
            const stratSel = document.getElementById('f6-strategy');
            const dimSel = document.getElementById('f6-dimension');
            this._f6ResetSelect(dimSel, '— เลือกวัตถุประสงค์ก่อน —');
            if (!issueId) { this._f6ResetSelect(stratSel, '— เลือกประเด็นก่อน —'); return; }
            const opts = (cache.strategies || []).filter(s => s.issueId === issueId);
            this._f6FillSelect(stratSel, opts, '— เลือกวัตถุประสงค์เชิงยุทธศาสตร์ —');
        } else if (step === 'strategy') {
            const strategyId = document.getElementById('f6-strategy')?.value || '';
            const dimSel = document.getElementById('f6-dimension');
            if (!strategyId) { this._f6ResetSelect(dimSel, '— เลือกวัตถุประสงค์ก่อน —'); return; }
            const opts = (cache.dimensions || []).filter(d => d.strategyId === strategyId);
            this._f6FillSelect(dimSel, opts, '— เลือกกลยุทธ์ —');
        }
    },

    _f6FillSelect(sel, items, placeholder) {
        if (!sel) return;
        sel.innerHTML = `<option value="">${placeholder}</option>` +
            items.map(x => `<option value="${x.id}">${x.name || x.label || x.id}</option>`).join('');
        sel.disabled = items.length === 0;
        sel.classList.toggle('f4-placeholder', !sel.value);
    },
    _f6ResetSelect(sel, placeholder) {
        if (!sel) return;
        sel.innerHTML = `<option value="">${placeholder}</option>`;
        sel.disabled = true;
        sel.classList.add('f4-placeholder');
    },

    /* ---------- SECTION E: กลุ่มเป้าหมาย / ผู้เข้าร่วม — auto sum ---------- */
    f6RecalcTargets() {
        const a = Number(document.getElementById('f6-target-staff')?.value || 0);
        const b = Number(document.getElementById('f6-target-student')?.value || 0);
        const c = Number(document.getElementById('f6-target-external')?.value || 0);
        const total = document.getElementById('f6-target-total');
        if (total) total.innerText = (a + b + c).toLocaleString();
    },
    f6RecalcAttendees() {
        const a = Number(document.getElementById('f6-attend-speaker')?.value || 0);
        const b = Number(document.getElementById('f6-attend-committee')?.value || 0);
        const total = document.getElementById('f6-attend-total');
        if (total) total.innerText = (a + b).toLocaleString();
    },

    /* ---------- SECTION F: ระยะดำเนินโครงการ (dynamic, เริ่มต้น 0 แถว) ---------- */
    f6AddPhaseRow() {
        const body = document.getElementById('f6-phase-rows');
        if (!body) return;
        const idx = body.children.length + 1;
        const rid = `f6-phase-${Date.now()}-${idx}`;
        const row = document.createElement('div');
        row.className = 'card-main p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-2';
        row.dataset.rid = rid;
        row.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-gray-500">ระยะที่ ${idx}</span>
                <button onclick="App.f6RemovePhaseRow('${rid}')" class="text-red-400 hover:text-red-600 no-print"><i data-lucide="x" size="16"></i></button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input class="input-flat w-full bg-white f6-phase-date" placeholder="วันที่ดำเนินโครงการ...">
                <input class="input-flat w-full bg-white f6-phase-place" placeholder="สถานที่...">
            </div>
            <div class="flex gap-6">
                <label class="flex items-center gap-2 text-sm"><input type="radio" name="${rid}-mode" value="Onsite" class="accent-indigo-600 f6-phase-mode"><span>Onsite</span></label>
                <label class="flex items-center gap-2 text-sm"><input type="radio" name="${rid}-mode" value="Online" class="accent-indigo-600 f6-phase-mode"><span>Online</span></label>
                <label class="flex items-center gap-2 text-sm"><input type="radio" name="${rid}-mode" value="แบบผสมผสาน" class="accent-indigo-600 f6-phase-mode"><span>แบบผสมผสาน</span></label>
            </div>`;
        body.appendChild(row);
        lucide.createIcons();
    },
    f6RemovePhaseRow(rid) {
        const row = document.querySelector(`#f6-phase-rows [data-rid="${rid}"]`);
        if (row) row.remove();
    },

    /* ---------- SECTION G: ตารางกิจกรรม 12 เดือน (dynamic) ---------- */
    f6AddActivityRow(presetLabel = '') {
        const body = document.getElementById('f6-activity-rows');
        if (!body) return;
        const rid = `act-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const tr = document.createElement('tr');
        tr.dataset.rid = rid;
        tr.innerHTML = `
            <td class="px-3 py-2"><input class="input-flat w-full bg-white f6-act-label" value="${presetLabel}" placeholder="ระบุกิจกรรม..."></td>
            ${['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'].map(m =>
                `<td class="px-2 py-2 text-center"><input type="checkbox" class="accent-indigo-600 f6-act-${m}"></td>`).join('')}
            <td class="px-2 py-2 no-print"><button onclick="App.f6RemoveRow('f6-activity-rows','${rid}')" class="text-red-400 hover:text-red-600"><i data-lucide="x" size="14"></i></button></td>`;
        body.appendChild(tr);
        lucide.createIcons();
    },

    /* ---------- SECTION I: รายการงบประมาณ 3 หมวด (dynamic + auto sum) ---------- */
    f6AddBudgetRow(groupKey) {
        const body = document.getElementById(`f6-budget-${groupKey}-rows`);
        if (!body) return;
        const rid = `bud-${groupKey}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const tr = document.createElement('tr');
        tr.dataset.rid = rid;
        tr.innerHTML = `
            <td class="px-3 py-2"><input class="input-flat w-full bg-white f6-bud-phase" placeholder="เช่น 1"></td>
            <td class="px-3 py-2"><input class="input-flat w-full bg-white f6-bud-label" placeholder="ระบุรายการ..."></td>
            <td class="px-3 py-2"><input type="number" min="0" step="0.01" class="input-flat w-full bg-white text-right f6-bud-amount" placeholder="0.00" onchange="App.f6RecalcBudget()"></td>
            <td class="px-2 py-2 no-print"><button onclick="App.f6RemoveRow('f6-budget-${groupKey}-rows','${rid}'); App.f6RecalcBudget();" class="text-red-400 hover:text-red-600"><i data-lucide="x" size="14"></i></button></td>`;
        body.appendChild(tr);
        lucide.createIcons();
        this.f6RecalcBudget();
    },
    f6RecalcBudget() {
        let grand = 0;
        ['compensation', 'service', 'material'].forEach(key => {
            const body = document.getElementById(`f6-budget-${key}-rows`);
            let sum = 0;
            if (body) {
                body.querySelectorAll('.f6-bud-amount').forEach(inp => sum += Number(inp.value || 0));
            }
            grand += sum;
            const sumEl = document.getElementById(`f6-sum-${key}`);
            if (sumEl) sumEl.innerText = sum.toLocaleString(undefined, { minimumFractionDigits: 2 });
        });
        const totalEl = document.getElementById('f6-total-amount');
        if (totalEl) totalEl.innerText = grand.toLocaleString(undefined, { minimumFractionDigits: 2 });
        return grand;
    },

    /* ---------- SECTION K: ตัวชี้วัด (dynamic แถว, ใช้ร่วม 21.1/21.2) ---------- */
    f6AddKpiRow(groupKey) {
        const body = document.getElementById(`f6-kpi-${groupKey}-rows`);
        if (!body) return;
        const units = (this._f6cache?.units || []);
        const rid = `kpi-${groupKey}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const tr = document.createElement('tr');
        tr.dataset.rid = rid;
        tr.innerHTML = `
            <td class="px-3 py-2"><input class="input-flat w-full bg-white f6-kpi-label" placeholder="ระบุตัวชี้วัด..."></td>
            <td class="px-3 py-2">
                <select class="input-flat w-full bg-white text-xs f6-kpi-unit">
                    <option value="">— หน่วยนับ —</option>
                    ${units.map(u => `<option value="${u.name}">${u.name}</option>`).join('')}
                </select>
            </td>
            <td class="px-3 py-2"><input type="number" class="input-flat w-full bg-white text-right f6-kpi-value" placeholder="0"></td>
            <td class="px-2 py-2 no-print"><button onclick="App.f6RemoveRow('f6-kpi-${groupKey}-rows','${rid}')" class="text-red-400 hover:text-red-600"><i data-lucide="x" size="14"></i></button></td>`;
        body.appendChild(tr);
        lucide.createIcons();
    },

    /* ---------- ตัวช่วยลบแถวทั่วไป ---------- */
    f6RemoveRow(bodyId, rid) {
        const row = document.querySelector(`#${bodyId} [data-rid="${rid}"]`);
        if (row) row.remove();
    },

    /* ---------- toggle ผลผลิตยุทธศาสตร์งบประมาณ 21.3 ---------- */
    f6ToggleOutputBlock(key) {
        const cb = document.getElementById(`f6-output-${key}`);
        const block = document.getElementById(`f6-output-${key}-block`);
        if (cb && block) block.classList.toggle('hidden', !cb.checked);
    },

    /* ---------- เก็บค่า checkbox/radio ทั้งหมดเป็น array/object ---------- */
    _f6CollectChecklist(ids) {
        return ids.filter(id => document.getElementById(id)?.checked).map(id => document.getElementById(id).value || id);
    },
    _f6Val(id) { return document.getElementById(id)?.value ?? ''; },
    _f6Checked(id) { return !!document.getElementById(id)?.checked; },

    /* ---------- รวบรวมข้อมูลทั้งฟอร์มเป็น payload ---------- */
    f6BuildPayload() {
        const collectPhases = () => Array.from(document.querySelectorAll('#f6-phase-rows [data-rid]')).map(row => ({
            date: row.querySelector('.f6-phase-date')?.value || '',
            place: row.querySelector('.f6-phase-place')?.value || '',
            mode: row.querySelector('.f6-phase-mode:checked')?.value || ''
        }));

        const collectActivities = () => Array.from(document.querySelectorAll('#f6-activity-rows [data-rid]')).map(row => {
            const months = {};
            ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'].forEach(m => {
                months[m] = !!row.querySelector(`.f6-act-${m}`)?.checked;
            });
            return { label: row.querySelector('.f6-act-label')?.value || '', months };
        });

        const collectBudgetRows = (key) => Array.from(document.querySelectorAll(`#f6-budget-${key}-rows [data-rid]`)).map(row => ({
            phase: row.querySelector('.f6-bud-phase')?.value || '',
            label: row.querySelector('.f6-bud-label')?.value || '',
            amount: Number(row.querySelector('.f6-bud-amount')?.value || 0)
        }));

        const collectKpiRows = (key) => Array.from(document.querySelectorAll(`#f6-kpi-${key}-rows [data-rid]`)).map(row => ({
            label: row.querySelector('.f6-kpi-label')?.value || '',
            unit: row.querySelector('.f6-kpi-unit')?.value || '',
            value: row.querySelector('.f6-kpi-value')?.value || ''
        }));

        const disbursement = {};
        ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'].forEach(m => {
            disbursement[m] = Number(document.getElementById(`f6-disb-${m}`)?.value || 0);
        });

        const totalAmount = this.f6RecalcBudget();

        const deptSel = document.getElementById('f6-dept');
        const deptName = deptSel?.selectedOptions?.[0]?.textContent?.trim() || '';
        const branchSel = document.getElementById('f6-branch');
        const branchName = branchSel?.selectedOptions?.[0]?.textContent?.trim() || '';
        const yearSel = document.getElementById('f6-year');
        const yearLabel = yearSel?.selectedOptions?.[0]?.textContent?.trim() || '';

        return {
            // ── ฟิลด์มาตรฐานสำหรับ Dashboard ──
            formType: 'ng6',
            formCode: 'ง.6',
            deptId: deptSel?.value || '',
            deptName,
            branchId: branchSel?.value || '',
            branchName,
            fiscalYear: yearLabel,
            itemName: this._f6Val('f6-project-name'),     // ชื่อโครงการ ใช้แสดงในตาราง/Dashboard
            requestedAmount: totalAmount,
            status: 'submitted',

            // ── รายละเอียดเต็มของฟอร์ม (ใช้สำหรับ print/แก้ไข) ──
            detail: {
                projectName: this._f6Val('f6-project-name'),
                nature: this._f6CollectChecklist(Array.from({length:8}, (_,i) => `f6-nature-${i}`)),
                natureOtherText: this._f6Val('f6-nature-other-text'),
                budgetSource: {
                    type: document.querySelector('input[name="f6-budget-src"]:checked')?.value || '',
                    year1: this._f6Val('f6-budget-src-y1'),
                    year2: this._f6Val('f6-budget-src-y2'),
                    otherText: this._f6Val('f6-budget-src-other')
                },
                plans: {
                    p41a: this._f6Checked('f6-plan41-a'), p41b: this._f6Checked('f6-plan41-b'),
                    p42a: this._f6Checked('f6-plan42-a'), p42b: this._f6Checked('f6-plan42-b'), p42c: this._f6Checked('f6-plan42-c'),
                    p42Project: this._f6Checked('f6-plan42-proj'), p42ProjectText: this._f6Val('f6-plan42-proj-text'),
                    p43Text: this._f6Val('f6-plan43-text'),
                    p43Project: this._f6Checked('f6-plan43-proj'), p43ProjectText: this._f6Val('f6-plan43-proj-text'),
                    p44: this._f6Checked('f6-plan44'), p44Text: this._f6Val('f6-plan44-text')
                },
                nationalStrategy: this._f6CollectChecklist(['f6-natstrat-2','f6-natstrat-3']),
                masterPlan: this._f6CollectChecklist(['f6-masterplan-8','f6-masterplan-11','f6-masterplan-12','f6-masterplan-23']),
                milestones: this._f6CollectChecklist(Array.from({length:13}, (_,i) => `f6-milestone-${i+1}`)),

                stratIssueId: this._f6Val('f6-issue'),
                stratIssueName: document.getElementById('f6-issue')?.selectedOptions?.[0]?.textContent?.trim() || '',
                stratStrategyId: this._f6Val('f6-strategy'),
                stratStrategyName: document.getElementById('f6-strategy')?.selectedOptions?.[0]?.textContent?.trim() || '',
                stratDimensionId: this._f6Val('f6-dimension'),
                stratDimensionName: document.getElementById('f6-dimension')?.selectedOptions?.[0]?.textContent?.trim() || '',

                rationale: this._f6Val('f6-rationale'),
                objective: this._f6Val('f6-objective'),
                integration: {
                    faculty: this._f6Val('f6-integrate-faculty'),
                    branch: this._f6Val('f6-integrate-branch'),
                    knowledge: this._f6Val('f6-integrate-knowledge')
                },

                target: {
                    staff: Number(this._f6Val('f6-target-staff') || 0),
                    student: Number(this._f6Val('f6-target-student') || 0),
                    external: Number(this._f6Val('f6-target-external') || 0),
                    externalText: this._f6Val('f6-target-external-text')
                },
                attendees: {
                    speaker: Number(this._f6Val('f6-attend-speaker') || 0),
                    committee: Number(this._f6Val('f6-attend-committee') || 0)
                },

                schedule: {
                    date: this._f6Val('f6-date'),
                    place: this._f6Val('f6-place'),
                    mode: document.querySelector('input[name="f6-mode"]:checked')?.value || '',
                    phases: collectPhases()
                },

                activities: collectActivities(),
                disbursementPlan: disbursement,

                budget: {
                    compensation: collectBudgetRows('compensation'),
                    service: collectBudgetRows('service'),
                    material: collectBudgetRows('material'),
                    totalAmount,
                    followupBudget: this._f6Val('f6-followup-budget')
                },

                expectedResults: {
                    ultimateOutcome: this._f6Val('f6-outcome-ultimate'),
                    outcome: this._f6Val('f6-outcome-mid'),
                    output: this._f6Val('f6-outcome-output')
                },

                evaluation: {
                    kpiPlan13: collectKpiRows('plan13'),
                    kpiProject: collectKpiRows('project'),
                    budgetStratYear: this._f6Val('f6-budget-strat-year'),
                    outputAcademic: this._f6Checked('f6-output-academic') ? {
                        item1: { unit: this._f6Val('f6-academic-1-unit'), value: this._f6Val('f6-academic-1-val') },
                        item2: { unit: this._f6Val('f6-academic-2-unit'), value: this._f6Val('f6-academic-2-val') }
                    } : null,
                    outputCulture: this._f6Checked('f6-output-culture') ? {
                        item1: { unit: this._f6Val('f6-culture-1-unit'), value: this._f6Val('f6-culture-1-val') },
                        item2: { unit: this._f6Val('f6-culture-2-unit'), value: this._f6Val('f6-culture-2-val') }
                    } : null,
                    outputWorkforce: this._f6Checked('f6-output-workforce') ? {
                        item1: { unit: this._f6Val('f6-workforce-1-unit'), value: this._f6Val('f6-workforce-1-val') },
                        item2: { label: this._f6Val('f6-workforce-2-label'), unit: this._f6Val('f6-workforce-2-unit'), value: this._f6Val('f6-workforce-2-val') }
                    } : null,
                    outputOther: this._f6Checked('f6-output-other') ? {
                        name: this._f6Val('f6-output-other-name'),
                        item1: { label: this._f6Val('f6-other-1-label'), unit: this._f6Val('f6-other-1-unit'), value: this._f6Val('f6-other-1-val') }
                    } : null
                },

                coordinator: {
                    name: this._f6Val('f6-coord-name'),
                    position: this._f6Val('f6-coord-position'),
                    phoneOffice: this._f6Val('f6-coord-phone-office'),
                    phoneMobile: this._f6Val('f6-coord-phone-mobile'),
                    email: this._f6Val('f6-coord-email')
                }
            }
        };
    },

    /* ---------- SAVE (พร้อม history sub-collection) ---------- */
    async saveForm6() {
        const projectName = this._f6Val('f6-project-name');
        const deptId = this._f6Val('f6-dept');
        const yearVal = this._f6Val('f6-year');

        if (!projectName) return alert('กรุณาระบุชื่อโครงการ (ข้อ 1)');
        if (!deptId) return alert('กรุณาเลือกหน่วยงาน');
        if (!yearVal) return alert('กรุณาเลือกปีงบประมาณ');

        const id = document.getElementById('f6-edit-id')?.value || '';
        const payload = this.f6BuildPayload();
        const now = firebase.firestore.FieldValue.serverTimestamp();

        const colRef = db.collection('artifacts').doc(appId)
            .collection('public').doc('data').collection('requests_ng6');

        try {
            this.showLoader();
            let docId = id;

            if (id) {
                payload.updatedBy = currentUser?.name || '';
                payload.updatedAt = now;
                await colRef.doc(id).update(payload);
            } else {
                payload.createdBy = currentUser?.name || '';
                payload.createdAt = now;
                payload.updatedBy = currentUser?.name || '';
                payload.updatedAt = now;
                payload.version = 1;
                const newRef = await colRef.add(payload);
                docId = newRef.id;
                document.getElementById('f6-edit-id').value = docId;
            }

            // เก็บ snapshot ลง history (append-only เพื่อย้อนดูเวอร์ชันก่อนหน้าได้)
            await colRef.doc(docId).collection('history').add({
                snapshot: payload,
                editedBy: currentUser?.name || '',
                editedAt: now
            });

            alert('บันทึกสำเร็จ');
            await this.loadForm6Records();
        } catch (e) {
            console.error('saveForm6 error', e);
            alert('บันทึกไม่สำเร็จ: ' + (e.message || e));
        } finally {
            this.hideLoader();
        }
    },

    /* ---------- LOAD list ---------- */
    async fetchForm6List() {
        const snap = await db.collection('artifacts').doc(appId)
            .collection('public').doc('data').collection('requests_ng6')
            .orderBy('createdAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async loadForm6Records() {
        const tbody = document.getElementById('f6-records-tbody');
        if (!tbody) return;
        try {
            const data = await this.fetchForm6List();
            if (!data.length) {
                tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400 text-xs font-bold">ยังไม่มีข้อมูล</td></tr>`;
                return;
            }
            tbody.innerHTML = data.map((d, i) => `
                <tr>
                    <td class="px-4 py-3 text-center text-gray-400">${i + 1}</td>
                    <td class="px-4 py-3 font-bold">${d.itemName || '-'}</td>
                    <td class="px-4 py-3">${d.deptName || '-'}</td>
                    <td class="px-4 py-3 text-right font-bold text-indigo-700">${Number(d.requestedAmount || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">${d.createdBy || '-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">${d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('th-TH') : '-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-2">
                            <button onclick="App.loadForm6ToForm('${d.id}')" class="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="แก้ไข"><i data-lucide="pencil" size="14"></i></button>
                            <button onclick="App.printForm6('${d.id}')" class="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100" title="Print"><i data-lucide="printer" size="14"></i></button>
                            <button onclick="App.deleteForm6('${d.id}')" class="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="ลบ"><i data-lucide="trash-2" size="14"></i></button>
                        </div>
                    </td>
                </tr>`).join('');
            lucide.createIcons();
        } catch (e) {
            console.error('loadForm6Records error', e);
            tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-400 text-xs font-bold">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
        }
    },

    /* ---------- EDIT: โหลดข้อมูลเดิมกลับเข้าฟอร์ม ---------- */
    async loadForm6ToForm(id) {
        try {
            this.showLoader();
            const doc = await db.collection('artifacts').doc(appId)
                .collection('public').doc('data').collection('requests_ng6').doc(id).get();
            if (!doc.exists) return alert('ไม่พบข้อมูล');
            const d = doc.data();
            const det = d.detail || {};

            document.getElementById('f6-edit-id').value = id;
            document.getElementById('f6-dept').value = d.deptId || '';
            this.f6LoadBranches();
            document.getElementById('f6-branch').value = d.branchId || '';
            document.getElementById('f6-year').value = ''; // ปล่อยให้ผู้ใช้ตรวจสอบ/เลือกใหม่ถ้าจำเป็น (label เทียบยาก)
            document.getElementById('f6-project-name').value = det.projectName || '';
            document.getElementById('f6-rationale').value = det.rationale || '';
            document.getElementById('f6-objective').value = det.objective || '';

            // ติ๊ก checkbox ลักษณะโครงการกลับ
            (det.nature || []).forEach(val => {
                document.querySelectorAll('#f6-project-name')[0]; // no-op guard
            });

            document.getElementById('f6-coord-name').value = det.coordinator?.name || '';
            document.getElementById('f6-coord-position').value = det.coordinator?.position || '';
            document.getElementById('f6-coord-phone-office').value = det.coordinator?.phoneOffice || '';
            document.getElementById('f6-coord-phone-mobile').value = det.coordinator?.phoneMobile || '';
            document.getElementById('f6-coord-email').value = det.coordinator?.email || '';

            document.getElementById('f6-date').value = det.schedule?.date || '';
            document.getElementById('f6-place').value = det.schedule?.place || '';

            document.getElementById('f6-target-staff').value = det.target?.staff || '';
            document.getElementById('f6-target-student').value = det.target?.student || '';
            document.getElementById('f6-target-external').value = det.target?.external || '';
            this.f6RecalcTargets();

            document.getElementById('f6-attend-speaker').value = det.attendees?.speaker || '';
            document.getElementById('f6-attend-committee').value = det.attendees?.committee || '';
            this.f6RecalcAttendees();

            document.getElementById('f6-outcome-ultimate').value = det.expectedResults?.ultimateOutcome || '';
            document.getElementById('f6-outcome-mid').value = det.expectedResults?.outcome || '';
            document.getElementById('f6-outcome-output').value = det.expectedResults?.output || '';

            document.getElementById('f6-followup-budget').value = det.budget?.followupBudget || '';

            // เติมแถวงบประมาณ 3 หมวด
            ['compensation','service','material'].forEach(key => {
                const body = document.getElementById(`f6-budget-${key}-rows`);
                if (!body) return;
                body.innerHTML = '';
                const rows = det.budget?.[key] || [];
                if (!rows.length) { this.f6AddBudgetRow(key); return; }
                rows.forEach(r => {
                    this.f6AddBudgetRow(key);
                    const last = body.lastElementChild;
                    if (last) {
                        last.querySelector('.f6-bud-phase').value = r.phase || '';
                        last.querySelector('.f6-bud-label').value = r.label || '';
                        last.querySelector('.f6-bud-amount').value = r.amount || '';
                    }
                });
            });
            this.f6RecalcBudget();

            // เติมแถวกิจกรรม
            const actBody = document.getElementById('f6-activity-rows');
            if (actBody && det.activities?.length) {
                actBody.innerHTML = '';
                det.activities.forEach(a => {
                    this.f6AddActivityRow(a.label || '');
                    const last = actBody.lastElementChild;
                    if (last) {
                        Object.keys(a.months || {}).forEach(m => {
                            const cb = last.querySelector(`.f6-act-${m}`);
                            if (cb) cb.checked = !!a.months[m];
                        });
                    }
                });
            }

            // แผนเบิกจ่าย
            Object.entries(det.disbursementPlan || {}).forEach(([m, v]) => {
                const el = document.getElementById(`f6-disb-${m}`);
                if (el) el.value = v || '';
            });

            // ตัวชี้วัด 21.1 / 21.2
            ['plan13','project'].forEach(key => {
                const body = document.getElementById(`f6-kpi-${key}-rows`);
                if (!body) return;
                const rows = det.evaluation?.[key === 'plan13' ? 'kpiPlan13' : 'kpiProject'] || [];
                body.innerHTML = '';
                if (!rows.length) { this.f6AddKpiRow(key); return; }
                rows.forEach(r => {
                    this.f6AddKpiRow(key);
                    const last = body.lastElementChild;
                    if (last) {
                        last.querySelector('.f6-kpi-label').value = r.label || '';
                        last.querySelector('.f6-kpi-unit').value = r.unit || '';
                        last.querySelector('.f6-kpi-value').value = r.value || '';
                    }
                });
            });

            // cascade ยุทธศาสตร์: ตั้งค่า issue ก่อนแล้วค่อย trigger cascade ไปหา strategy/dimension
            if (det.stratIssueId) {
                document.getElementById('f6-issue').value = det.stratIssueId;
                this.f6CascadeStep('issue');
                setTimeout(() => {
                    if (det.stratStrategyId) {
                        document.getElementById('f6-strategy').value = det.stratStrategyId;
                        this.f6CascadeStep('strategy');
                        setTimeout(() => {
                            if (det.stratDimensionId) document.getElementById('f6-dimension').value = det.stratDimensionId;
                        }, 150);
                    }
                }, 150);
            }

            alert('โหลดข้อมูลเข้าฟอร์มแล้ว — แก้ไขแล้วกด "บันทึก" เพื่ออัปเดต');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            console.error('loadForm6ToForm error', e);
            alert('โหลดข้อมูลไม่สำเร็จ');
        } finally {
            this.hideLoader();
        }
    },

    /* ---------- DELETE ---------- */
    async deleteForm6(id) {
        if (!confirm('ยืนยันการลบรายการนี้? (ประวัติเดิมจะถูกลบไปด้วย)')) return;
        try {
            this.showLoader();
            await db.collection('artifacts').doc(appId)
                .collection('public').doc('data').collection('requests_ng6').doc(id).delete();
            alert('ลบสำเร็จ');
            await this.loadForm6Records();
        } catch (e) {
            console.error('deleteForm6 error', e);
            alert('ลบไม่สำเร็จ');
        } finally {
            this.hideLoader();
        }
    },

    /* ---------- RESET ---------- */
    resetForm6() {
        if (!confirm('ล้างข้อมูลในฟอร์มทั้งหมด?')) return;
        document.getElementById('f6-edit-id').value = '';
        document.querySelectorAll('#content-view input[id^="f6-"], #content-view textarea[id^="f6-"]').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
            else el.value = '';
        });
        ['f6-activity-rows','f6-budget-compensation-rows','f6-budget-service-rows','f6-budget-material-rows',
         'f6-kpi-plan13-rows','f6-kpi-project-rows','f6-phase-rows'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        this.f6RecalcBudget();
        this.f6RecalcTargets();
        this.f6RecalcAttendees();
        this.initManageForm6();
    },

    /* ---------- PRINT: โหลด record จาก Firestore ตรงๆ มาฉีดใส่ฟอร์มปัจจุบันแล้วสั่งพิมพ์ ---------- */
    async printForm6(id) {
        await this.loadForm6ToForm(id);
        // log การพิมพ์ (เผื่อหน่วยงานหลักถามว่าพิมพ์ฉบับล่าสุดหรือยัง)
        try {
            await db.collection('artifacts').doc(appId)
                .collection('public').doc('data').collection('requests_ng6').doc(id)
                .update({ printedAt: firebase.firestore.FieldValue.serverTimestamp(), printedBy: currentUser?.name || '' });
        } catch (e) { console.warn('printedAt log failed', e); }
        setTimeout(() => window.print(), 400);
    }

};
/* ===== Firebase ใช้ของเดิม ===== */

/* ===== FORM4 CRUD ===== */

async function fetchForm4List() {
    const snap = await db.collection('artifacts')
        .doc('budget-manage-v001')
        .collection('public')
        .doc('data')
        .collection('form4')
        .orderBy('createdAt', 'desc')
        .get();

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadForm4Table() {
    const data = await fetchForm4List();
    renderForm4Table(data);
}

async function deleteForm4(id) {
    if (!confirm("ยืนยันการลบ?")) return;

    await db.collection('artifacts')
        .doc('budget-manage-v001')
        .collection('public')
        .doc('data')
        .collection('form4')
        .doc(id)
        .delete();

    alert("ลบสำเร็จ");
    loadForm4Table();
}

async function loadForm4ToForm(id) {
    const doc = await db.collection('artifacts')
        .doc('budget-manage-v001')
        .collection('public')
        .doc('data')
        .collection('form4')
        .doc(id)
        .get();

    const d = doc.data();

    document.getElementById('f4-item').value = d.itemName || "";
    document.getElementById('f4-amount').value = d.totalAmount || "";
    document.getElementById('f4-edit-id').value = id;

    alert("โหลดข้อมูลแล้ว");
}

function previewForm4(d) {
    alert(
`รายการ: ${d.itemName}
วงเงิน: ${d.totalAmount}
หน่วยงาน: ${d.deptName}
ปี: ${d.fiscalYear}`
    );
}

async function saveForm4() {
    const id = document.getElementById('f4-edit-id').value;

    const payload = {
        itemName: document.getElementById('f4-item').value,
        totalAmount: Number(document.getElementById('f4-amount').value),
        updatedAt: new Date()
    };

    const ref = db.collection('artifacts')
        .doc('budget-manage-v001')
        .collection('public')
        .doc('data')
        .collection('form4');

    if (id) {
        await ref.doc(id).update(payload);
    } else {
        payload.createdAt = new Date();
        await ref.add(payload);
    }

    alert("บันทึกสำเร็จ");
    document.getElementById('f4-edit-id').value = "";
    loadForm4Table();
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("form4-table")) {
        loadForm4Table();
    }
});