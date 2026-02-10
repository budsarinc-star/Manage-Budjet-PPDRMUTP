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
            case 'manage': title.innerText = "2. จัดการข้อมูลครุภัณฑ์"; view.innerHTML = UI.managePage(); break;
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
        }
        lucide.createIcons();
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
        const s10 = document.getElementById('strat-parent-10'); // plans
        const s11 = document.getElementById('strat-parent-11'); // issues
        const s12 = document.getElementById('strat-parent-12'); // strategies
        const s13 = document.getElementById('strat-parent-13'); // bsc dims

        // ถ้า UI ยังไม่ render (ไม่ได้อยู่หน้า admin tab1) ก็ข้าม
        if (!s10 || !s11 || !s12 || !s13) return;

        // เติมฉบับแผน
        this.fillStratPlanSelect();

        // เมื่อเปลี่ยนฉบับแผน -> เติมประเด็นยุทธศาสตร์ -> เติมกลยุทธ์ -> reset มิติ
        s10.onchange = async () => {
            await this.fillStratIssueSelect(s10.value);
        };

        // เมื่อเปลี่ยนประเด็นยุทธศาสตร์ -> เติมกลยุทธ์ -> reset มิติ
        s11.onchange = async () => {
            await this.fillStratStrategySelect(s11.value);
        };

        // เมื่อเปลี่ยนกลยุทธ์ -> เติมมิติ
        s12.onchange = async () => {
            await this.fillBscSelect(s12.value);
        };
    },

    
adminResetStratLinkingUI() {
    // เคลียร์ค่าในส่วน "หมวดข้อมูลยุทธศาสตร์และตัวชี้วัด (โปรดระบุความเชื่อมโยง)"
    // เพื่อกันเคสลบแล้วค่าค้าง/ดึงผิด
    const ids = ['strat-parent-10','strat-parent-11','strat-parent-12','strat-parent-13'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const inputs = ['strat-lvl-9','strat-lvl-10','strat-lvl-11','strat-lvl-12','strat-lvl-13'];
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

            if (level === 9) {
                const name = (document.getElementById('strat-lvl-9')?.value || '').trim();
                if (!name) return alert("กรุณาระบุข้อมูล");
                this.showLoader();
                await db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('strat_plans')
                    .add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
                document.getElementById('strat-lvl-9').value = '';
                alert("บันทึกสำเร็จ");
                await this.fillStratPlanSelect();
                await this.refreshAdminStratLinks();
                this.hideLoader();
                return;
            }

            if (level === 10) {
                const planId = document.getElementById('strat-parent-10')?.value || '';
                const name = (document.getElementById('strat-lvl-10')?.value || '').trim();
                if (!planId) return alert("กรุณาเลือกฉบับแผน");
                if (!name) return alert("กรุณาระบุข้อมูล");
                this.showLoader();
                await db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('strat_issues')
                    .add({ planId, name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
                document.getElementById('strat-lvl-10').value = '';
                alert("เชื่อมโยงสำเร็จ");
                await this.fillStratIssueSelect(planId);
                await this.refreshAdminStratLinks();
                this.hideLoader();
                return;
            }

            // กลยุทธ์ (ผูกกับประเด็นยุทธศาสตร์)
            if (level === 11) {
                const issueId = document.getElementById('strat-parent-11')?.value || '';
                const name = (document.getElementById('strat-lvl-11')?.value || '').trim();
                if (!issueId) return alert("กรุณาเลือกประเด็นยุทธศาสตร์");
                if (!name) return alert("กรุณาระบุข้อมูล");
                this.showLoader();
                await db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('strat_strategies')
                    .add({ issueId, name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
                document.getElementById('strat-lvl-11').value = '';
                alert("เชื่อมโยงสำเร็จ");
                await this.fillStratStrategySelect(issueId);
                await this.refreshAdminStratLinks();
                this.hideLoader();
                return;
            }

            // มิติ (ผูกกับกลยุทธ์)
            if (level === 12) {
                const issueId = document.getElementById('strat-parent-11')?.value || '';
                const strategyId = document.getElementById('strat-parent-12')?.value || '';
                const name = (document.getElementById('strat-lvl-12')?.value || '').trim();
                if (!strategyId) return alert("กรุณาเลือกกลยุทธ์");
                if (!name) return alert("กรุณาระบุข้อมูล");
                this.showLoader();
                await db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('bsc_dims')
                    .add({ strategyId, issueId, name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
                document.getElementById('strat-lvl-12').value = '';
                alert("เชื่อมโยงสำเร็จ");
                await this.fillBscSelect(strategyId);
                await this.refreshAdminStratLinks();
                this.hideLoader();
                return;
            }

            // ตัวชี้วัด (ผูกกับมิติ)
            if (level === 13) {
                const bscId = document.getElementById('strat-parent-13')?.value || '';
                const name = (document.getElementById('strat-lvl-13')?.value || '').trim();
                if (!bscId) return alert("กรุณาเลือกมิติ");
                if (!name) return alert("กรุณาระบุข้อมูล");
                this.showLoader();
                await db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('strat_kpis')
                    .add({ bscId, name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
                document.getElementById('strat-lvl-13').value = '';
                alert("เชื่อมโยงสำเร็จ");
                await this.refreshAdminStratLinks();
                this.hideLoader();
                return;
            }
        } catch (err) {
            console.error(err);
            this.hideLoader();
            alert("เกิดข้อผิดพลาด");
        }
    },

    async fillStratPlanSelect() {
        const sel = document.getElementById('strat-parent-10');
        if (!sel) return;

        const dataRef = db.collection('artifacts').doc(appId).collection('public').doc('data');
        const colRef = dataRef.collection('strat_plans');

        // โหลดฉบับแผนจากฐานข้อมูลจริง
        let snap;
        try {
            snap = await colRef.orderBy('createdAt', 'desc').get();
        } catch {
            snap = await colRef.get();
        }

        // ใช้ "ข้อมูลเชื่อมโยงจริง" เป็นตัวกรอง dropdown
        // เพื่อแก้เคส: ลบแล้วตารางหาย แต่ dropdown ยังมีฉบับเดิมค้าง (เช่น 13/14/15)
        // หลักการ: ฉบับแผนที่ควรแสดง = ฉบับแผนที่ยังมี KPI เชื่อมโยงอยู่จริง (เดิน chain: KPI -> มิติ -> กลยุทธ์ -> ประเด็น -> ฉบับแผน)
        const usedPlanIds = await (async () => {
            try {
                const kpiSnap = await dataRef.collection('strat_kpis').get();
                if (kpiSnap.empty) return new Set();

                const dimIds = new Set();
                kpiSnap.docs.forEach(d => {
                    const r = d.data() || {};
                    const dimId = r.bscId || r.dimId || r.parentId || '';
                    if (dimId) dimIds.add(dimId);
                });
                if (dimIds.size === 0) return new Set();

                const dimSnap = await dataRef.collection('bsc_dims').get();
                const dimToStrategy = new Map();
                dimSnap.docs.forEach(d => {
                    const r = d.data() || {};
                    const sid = r.strategyId || r.parentId || '';
                    if (sid) dimToStrategy.set(d.id, sid);
                });

                const strategyIds = new Set(Array.from(dimIds).map(id => dimToStrategy.get(id)).filter(Boolean));
                if (strategyIds.size === 0) return new Set();

                const stratSnap = await dataRef.collection('strat_strategies').get();
                const stratToIssue = new Map();
                stratSnap.docs.forEach(d => {
                    const r = d.data() || {};
                    const iid = r.issueId || r.parentId || '';
                    if (iid) stratToIssue.set(d.id, iid);
                });

                const issueIds = new Set(Array.from(strategyIds).map(id => stratToIssue.get(id)).filter(Boolean));
                if (issueIds.size === 0) return new Set();

                const issueSnap = await dataRef.collection('strat_issues').get();
                const issueToPlan = new Map();
                issueSnap.docs.forEach(d => {
                    const r = d.data() || {};
                    const pid = r.planId || r.parentId || '';
                    if (pid) issueToPlan.set(d.id, pid);
                });

                const planIds = new Set(Array.from(issueIds).map(id => issueToPlan.get(id)).filter(Boolean));
                return planIds;
            } catch (e) {
                console.warn('fillStratPlanSelect: cannot derive usedPlanIds', e);
                return new Set();
            }
        })();

        // ถ้าไม่มีข้อมูลเชื่อมโยงจริงในตาราง (เช่นลบหมดแล้ว) ให้ dropdown ว่าง (กันโชว์ฉบับที่ค้าง)
        if (usedPlanIds.size === 0) {
            sel.innerHTML = '<option value="">เลือกฉบับที่</option>';
            await this.fillStratIssueSelect('');
            return;
        }

        // de-dup: กันชื่อซ้ำ/เอกสารซ้ำ (เลือกตัวที่ใหม่กว่า)
        const byKey = new Map(); // key: normalizedName
        snap.docs.forEach(d => {
            if (!usedPlanIds.has(d.id)) return;
            const data = d.data() || {};
            const name = (data.name || data.title || '').toString().trim();
            if (!name) return;

            const norm = name.replace(/\s+/g, ' ').trim().toLowerCase();
            const cur = byKey.get(norm);
            const curTs = cur?.createdAt?.seconds || 0;
            const ts = data.createdAt?.seconds || 0;
            if (!cur || ts >= curTs) byKey.set(norm, { id: d.id, name, createdAt: data.createdAt });
        });

        const list = Array.from(byKey.values())
            .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const prev = sel.value;
        sel.innerHTML = '<option value="">เลือกฉบับที่</option>' + list.map(x => `<option value="${x.id}">${x.name}</option>`).join('');

        // รักษาค่าที่เลือก ถ้ายังมีอยู่ ไม่งั้นเลือกตัวบนสุด
        if (prev && list.some(x => x.id === prev)) sel.value = prev;
        else if (list[0]?.id) sel.value = list[0].id;

        await this.fillStratIssueSelect(sel.value);
    },
    async fillStratIssueSelect(planId) {
        const sel = document.getElementById('strat-parent-11');
        if (!sel) return;

        if (!planId) {
            sel.innerHTML = '<option value="">เลือกยุทธศาสตร์</option>';
            await this.fillStratStrategySelect('');
            await this.fillBscSelect('');
            return;
        }

        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_issues').where('planId', '==', planId).get();

        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        sel.innerHTML = '<option value="">เลือกยุทธศาสตร์</option>' + docs.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

        const issueId = sel.value || (docs[0]?.id || '');
        if (issueId && !sel.value) sel.value = issueId;
        await this.fillStratStrategySelect(sel.value);
    },

    async fillStratStrategySelect(issueId) {
        const sel = document.getElementById('strat-parent-12');
        const dimSel = document.getElementById('strat-parent-13');
        if (!sel) return;

        if (!issueId) {
            sel.innerHTML = '<option value="">เลือกกลยุทธ์</option>';
            if (dimSel) dimSel.innerHTML = '<option value="">เลือกมิติ</option>';
            return;
        }

        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_strategies').where('issueId', '==', issueId).get();

        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        sel.innerHTML = '<option value="">เลือกกลยุทธ์</option>' + docs.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

        const strategyId = sel.value || (docs[0]?.id || '');
        if (strategyId && !sel.value) sel.value = strategyId;

        await this.fillBscSelect(sel.value);
    },

    async fillBscSelect(strategyId) {
        const sel = document.getElementById('strat-parent-13');
        if (!sel) return;

        if (!strategyId) {
            sel.innerHTML = '<option value="">เลือกมิติ</option>';
            return;
        }

        // มิติจะผูกกับกลยุทธ์ (strategyId)
        let docs = [];
        try {
            const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
                .collection('bsc_dims').where('strategyId', '==', strategyId).get();
            docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            // เผื่อไม่มี index/field
            docs = [];
        }

        docs = docs.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        sel.innerHTML = '<option value="">เลือกมิติ</option>' + docs.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

        const bscId = sel.value || (docs[0]?.id || '');
        if (bscId && !sel.value) sel.value = bscId;
    },

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
    return db.collection('artifacts').doc(appId).collection('public').doc('data').collection(key);
},

ensureAdminTableState(key) {
    if (!adminTableState[key]) adminTableState[key] = { page: 1, limit: 10, fullData: [], searchQuery: '' };
    return adminTableState[key];
},

async loadAdminTable(key) {
    try {
        const st = this.ensureAdminTableState(key);
        const colRef = this.getAdminColRef(key);
        let snap;
        try {
            snap = await colRef.orderBy('createdAt', 'desc').get();
        } catch {
            snap = await colRef.get();
        }
        st.fullData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (st.page < 1) st.page = 1;
        this.renderAdminTable(key);
    } catch (e) {
        console.error("loadAdminTable error", key, e);
    }
},

async loadAdminAllTables() {
    if (typeof db === 'undefined') return;

    const keys = ['budget_types','years','items','categories','depts','branches','strat_plans','strat_issues','strat_strategies','bsc_dims','strat_kpis'];
    for (const k of keys) await this.loadAdminTable(k);

    // สร้าง map สำหรับการแสดงชื่อความเชื่อมโยง
    this.adminBuildStratMaps();

    // สร้าง "ตารางรวม" แผนพัฒนามหาวิทยาลัยฯ และความเชื่อมโยง (ฉบับแผน > ยุทธศาสตร์ > มิติ > ตัวชี้วัด)
    this.adminBuildStratLinks();

    // render ตารางที่อ้างอิง map
    ['strat_issues','strat_strategies','bsc_dims','strat_kpis','strat_links'].forEach(k => this.renderAdminTable(k));
},


async refreshAdminStratLinks() {
    // รีเฟรชตาราง "แผนพัฒนาฯ และความเชื่อมโยง" ให้ดึงข้อมูลจริงล่าสุดจากฐานข้อมูล
    // (แก้เคสเพิ่มข้อมูลแล้วไม่แสดง เพราะ state ยังไม่ reload)
    if (typeof db === 'undefined') return;
    await this.loadAdminTable('strat_plans');
    await this.loadAdminTable('strat_issues');
    await this.loadAdminTable('strat_strategies');
    await this.loadAdminTable('bsc_dims');
    await this.loadAdminTable('strat_kpis');
    this.adminBuildStratMaps();
    this.adminBuildStratLinks();
    ['strat_links','strat_issues','strat_strategies','bsc_dims','strat_kpis'].forEach(k => this.renderAdminTable(k));
},

adminBuildStratMaps() {
    const planMap = {};
    const issueMap = {};
    const strategyMap = {};
    const dimMap = {};

    (adminTableState['strat_plans']?.fullData || []).forEach(x => { planMap[x.id] = x.name || x.title || '-'; });
    (adminTableState['strat_issues']?.fullData || []).forEach(x => { issueMap[x.id] = x.name || x.title || '-'; });
    (adminTableState['strat_strategies']?.fullData || []).forEach(x => { strategyMap[x.id] = x.name || x.title || '-'; });
    (adminTableState['bsc_dims']?.fullData || []).forEach(x => { dimMap[x.id] = x.name || x.title || '-'; });

    adminTableState._planMap = planMap;
    adminTableState._issueMap = issueMap;
    adminTableState._strategyMap = strategyMap;
    adminTableState._dimMap = dimMap;
},

adminBuildStratLinks() {
    // แถวในตารางรวม = ระดับ "ตัวชี้วัด" (strat_kpis) แล้วไล่ขึ้นไปหา มิติ/กลยุทธ์/ประเด็นยุทธศาสตร์/ฉบับแผน
    // รองรับ field ได้หลายแบบ (กัน schema ต่างกันแล้วขึ้น "-")
    const planMap = adminTableState._planMap || {};
    const issueMap = adminTableState._issueMap || {};
    const strategyMap = adminTableState._strategyMap || {};
    const dimMap = adminTableState._dimMap || {};

    const issues = adminTableState['strat_issues']?.fullData || [];
    const strategies = adminTableState['strat_strategies']?.fullData || [];
    const dims = adminTableState['bsc_dims']?.fullData || [];
    const kpis = adminTableState['strat_kpis']?.fullData || [];

    const issueById = {};
    const strategyById = {};
    const dimById = {};
    issues.forEach(x => { issueById[x.id] = x; });
    strategies.forEach(x => { strategyById[x.id] = x; });
    dims.forEach(x => { dimById[x.id] = x; });

    const rows = kpis.map(k => {
        const dimId = k.bscId || k.dimId || k.parentId || '';
        const dim = dimById[dimId] || {};

        // มิติ -> กลยุทธ์ (ใหม่) หรือ fallback เป็น issue เดิม
        const strategyId = dim.strategyId || dim.stratStrategyId || '';
        const strategy = strategyById[strategyId] || {};

        const issueId = (
            strategy.issueId || strategy.stratIssueId ||
            dim.issueId || dim.stratIssueId || dim.parentId || ''
        );
        const issue = issueById[issueId] || {};

        const planId = issue.planId || issue.stratPlanId || issue.parentId || '';

        const planName = planMap[planId] || '-';
        const issueName = issueMap[issueId] || issue.name || issue.title || '-';
        const strategyName = strategyMap[strategyId] || strategy.name || strategy.title || (strategyId ? '-' : '-');
        const dimName = dimMap[dimId] || dim.name || dim.title || '-';
        const kpiName = k.name || k.title || '-';

        return {
            id: k.id,        // ใช้ id ของตัวชี้วัดเป็นหลัก
            kpiId: k.id,
            planId,
            issueId,
            strategyId,
            dimId,
            planName,
            issueName,
            strategyName,
            dimName,
            name: kpiName,
            createdAt: k.createdAt || k.updatedAt
        };
    });

    // เรียงลำดับตามสายโซ่: ฉบับแผน > ประเด็นยุทธศาสตร์ > กลยุทธ์ > มิติ > ตัวชี้วัด
    rows.sort((a,b) => {
        const as = [a.planName, a.issueName, a.strategyName, a.dimName, a.name].map(x => (x||'').toString());
        const bs = [b.planName, b.issueName, b.strategyName, b.dimName, b.name].map(x => (x||'').toString());
        for (let i=0;i<as.length;i++){
            const c = as[i].localeCompare(bs[i], 'th');
            if (c !== 0) return c;
        }
        // ถ้าชื่อเท่ากันให้เอาใหม่กว่าไว้บน
        return ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    });

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
                ${colSm(x.planName || '-', 'font-bold text-indigo-900')}
                ${colSm(x.issueName || '-', 'font-bold text-indigo-900')}
                ${colSm(x.strategyName || '-', 'font-bold text-indigo-900')}
                ${colSm(x.dimName || '-', 'font-bold text-indigo-900')}
                ${colSm(name)}
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

        if (key === 'strat_issues') {
            const parent = planMap[x.planId] || planMap[x.parentId] || x.parentName || '-';
            return `<tr>
                ${colSm(idx)}
                ${colSm(parent, 'font-bold text-indigo-900')}
                ${colSm(name)}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }

        if (key === 'bsc_dims') {
            const parent = issueMap[x.issueId] || issueMap[x.parentId] || x.parentName || '-';
            return `<tr>
                ${colSm(idx)}
                ${colSm(parent, 'font-bold text-indigo-900')}
                ${colSm(name)}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }

        if (key === 'strat_kpis') {
            const parent = dimMap[x.bscId] || dimMap[x.parentId] || x.parentName || '-';
            return `<tr>
                ${colSm(idx)}
                ${colSm(parent, 'font-bold text-indigo-900')}
                ${colSm(name)}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${iconBtn('edit', `App.adminEdit('${key}','${x.id}')`)}
                        ${iconBtn('del', `App.adminDelete('${key}','${x.id}')`)}
                    </div>
                </td>
            </tr>`;
        }

        if (['strat_plans'].includes(key)) {
            return `<tr>
                ${colSm(idx)}
                ${colSm(name)}
                ${colSm(createdAt)}
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
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

adminShowEditModal(innerHtml) {
    const root = document.getElementById('admin-edit-modal');
    if (!root) return;
    root.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    root.innerHTML = `
      <div class="absolute inset-0 bg-black/40" onclick="App.adminCloseEditModal()"></div>
      <div class="relative w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl border border-purple-50 overflow-hidden">
        ${innerHtml}
      </div>
    `;
    document.body.classList.add('overflow-hidden');
    lucide.createIcons();
},

async adminEdit(key, id) {
    try {
        if (!db) return alert('Firebase Error');

        // หา row จาก state ก่อน (เพื่อเช็คว่ามีจริง)
        const row = (adminTableState?.[key]?.fullData || []).find(r => r.id === id) || null;
        if (!row && key !== 'strat_links') return alert('ไม่พบข้อมูล');

        // helper
        const header = (title) => `
          <div class="px-7 py-6 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <div class="text-xs font-bold text-purple-600">แก้ไขข้อมูล</div>
              <div class="text-xl font-black text-slate-900">${title}</div>
            </div>
            <button class="p-2 rounded-xl hover:bg-slate-100" onclick="App.adminCloseEditModal()">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>`;

        const footer = () => `
          <div class="px-7 py-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/60">
            <button class="px-5 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50" onclick="App.adminCloseEditModal()">ยกเลิก</button>
            <button class="px-5 py-2 rounded-xl bg-purple-600 text-white font-black hover:bg-purple-700" onclick="App.adminModalSave('${key}','${id}')">
              <span class="inline-flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i>บันทึก</span>
            </button>
          </div>`;

        // --- special: years ---
        if (key === 'years') {
            const year = (row?.year ?? row?.name ?? '').toString();
            const status = (row?.status ?? '').toString();
            const note = (row?.note ?? '').toString();

            this.adminShowEditModal(`
              ${header('ปีงบประมาณ')}
              <div class="p-7 space-y-5">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">ปี พ.ศ.</div>
                    <input id="adm-edit-year" class="input-flat w-full" value="${year}">
                  </div>
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">สถานะปีงบประมาณ</div>
                    <input id="adm-edit-status" class="input-flat w-full" value="${status}">
                  </div>
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">หมายเหตุ</div>
                    <input id="adm-edit-note" class="input-flat w-full" value="${note}">
                  </div>
                </div>
              </div>
              ${footer()}
            `);
            return;
        }

        // --- special: branches (มีความเชื่อมโยงหน่วยงาน) ---
        if (key === 'branches') {
            const depts = (adminTableState?.['depts']?.fullData || []);
            const deptId = (row?.deptId || '').toString();
            const name = (row?.name || '').toString();

            const deptOptions = depts.map(d => `<option value="${d.id}">${(d.name||'-').toString()}</option>`).join('');

            this.adminShowEditModal(`
              ${header('สาขา / งาน')}
              <div class="p-7 space-y-5">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">หน่วยงาน</div>
                    <select id="adm-edit-dept" class="input-flat w-full">${deptOptions}</select>
                  </div>
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">สาขา/งาน</div>
                    <input id="adm-edit-name" class="input-flat w-full" value="${name}">
                  </div>
                </div>
              </div>
              ${footer()}
            `);
            const sel = document.getElementById('adm-edit-dept');
            if (sel && deptId) sel.value = deptId;
            return;
        }

        // --- special: strat_links (ตารางรวม: ฉบับแผน > ประเด็น > กลยุทธ์ > มิติ > ตัวชี้วัด) ---
        if (key === 'strat_links') {
            this.showLoader();

            // ดึง chain จากฐานข้อมูลจริง (id ของตารางรวม = id ของตัวชี้วัด)
            const kpiRef = this.getAdminColRef('strat_kpis').doc(id);
            const kpiSnap = await kpiRef.get();
            if (!kpiSnap.exists) { this.hideLoader(); return alert('ไม่พบข้อมูลตัวชี้วัด'); }
            const kpiDoc = { id: kpiSnap.id, ...kpiSnap.data() };

            const dimId = kpiDoc.bscId || kpiDoc.dimId || kpiDoc.parentId || '';
            const dimSnap = dimId ? await this.getAdminColRef('bsc_dims').doc(dimId).get() : null;
            const dimDoc = (dimSnap && dimSnap.exists) ? { id: dimSnap.id, ...dimSnap.data() } : {};

            const strategyId = dimDoc.strategyId || dimDoc.stratStrategyId || '';
            const stratSnap = strategyId ? await this.getAdminColRef('strat_strategies').doc(strategyId).get() : null;
            const stratDoc = (stratSnap && stratSnap.exists) ? { id: stratSnap.id, ...stratSnap.data() } : {};

            const issueId = stratDoc.issueId || stratDoc.stratIssueId || dimDoc.issueId || dimDoc.stratIssueId || dimDoc.parentId || '';
            const issueSnap = issueId ? await this.getAdminColRef('strat_issues').doc(issueId).get() : null;
            const issueDoc = (issueSnap && issueSnap.exists) ? { id: issueSnap.id, ...issueSnap.data() } : {};

            const planId = issueDoc.planId || issueDoc.stratPlanId || issueDoc.parentId || '';
            const planSnap = planId ? await this.getAdminColRef('strat_plans').doc(planId).get() : null;
            const planDoc = (planSnap && planSnap.exists) ? { id: planSnap.id, ...planSnap.data() } : {};

            const planName = (planDoc.name || planDoc.title || row?.planName || row?.plan || '').toString();
            const issueName = (issueDoc.name || issueDoc.title || row?.issueName || row?.issue || '').toString();
            const strategyName = (stratDoc.name || stratDoc.title || row?.strategyName || row?.strategy || '').toString();
            const dimName = (dimDoc.name || dimDoc.title || row?.dimName || row?.dim || '').toString();
            const kpiName = (kpiDoc.name || kpiDoc.title || row?.kpiName || row?.kpi || '').toString();

            this.hideLoader();

            this.adminShowEditModal(`
              ${header('แก้ไขความเชื่อมโยงแผนพัฒนาฯ')}
              <div class="p-7 space-y-5">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">ฉบับแผน</div>
                    <input id="adm-edit-plan-name" class="input-flat w-full" value="${planName}">
                  </div>
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">ประเด็นยุทธศาสตร์</div>
                    <input id="adm-edit-issue-name" class="input-flat w-full" value="${issueName}">
                  </div>
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">กลยุทธ์</div>
                    <input id="adm-edit-strategy-name" class="input-flat w-full" value="${strategyName}">
                  </div>
                  <div>
                    <div class="text-xs font-black text-slate-600 mb-2">มิติ</div>
                    <input id="adm-edit-dim-name" class="input-flat w-full" value="${dimName}">
                  </div>
                </div>
                <div>
                  <div class="text-xs font-black text-slate-600 mb-2">ตัวชี้วัด</div>
                  <input id="adm-edit-kpi-name" class="input-flat w-full" value="${kpiName}">
                </div>
                <div class="text-[11px] font-bold text-slate-400">
                  * แก้ไขได้ทุกช่อง และจะบันทึกลงฐานข้อมูลจริงตามระดับ (ฉบับแผน/ประเด็น/กลยุทธ์/มิติ/ตัวชี้วัด)
                </div>
              </div>
              ${footer()}
            `);
            return;
        }

        // --- default (ชื่อเดียว) ---
        const name = (row?.name || row?.title || '').toString();
        this.adminShowEditModal(`
          ${header('แก้ไขข้อมูล')}
          <div class="p-7 space-y-5">
            <div>
              <div class="text-xs font-black text-slate-600 mb-2">ชื่อ</div>
              <input id="adm-edit-name" class="input-flat w-full" value="${name}">
            </div>
          </div>
          ${footer()}
        `);
    } catch (e) {
        console.error('adminEdit error', e);
        alert('ไม่สามารถเปิดหน้าต่างแก้ไขได้');
        this.hideLoader?.();
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
    const dims = adminTableState['bsc_dims']?.fullData || [];
    const sel = document.getElementById('adm-edit-dim');
    if (!sel) return;
    const rows = dims.filter(x => (x.issueId || x.parentId || '') === issueId);
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
                const dimRef = this.getAdminColRef('bsc_dims').doc(dimId);
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
        const realKey = (key === 'strat_links') ? 'strat_kpis' : key;

        const ok = confirm('ยืนยันลบข้อมูลนี้?');
        if (!ok) return;

        this.showLoader();

        // ลบข้อมูลจริง
        await this.getAdminColRef(realKey).doc(id).delete();

        // รีเฟรชข้อมูลจากฐานข้อมูลจริงทันที (กันเคสต้องกดรีเฟรช/ออกหน้าอื่น)
        if (['strat_links','strat_plans','strat_issues','strat_strategies','bsc_dims','strat_kpis'].includes(key) ||
            ['strat_plans','strat_issues','strat_strategies','bsc_dims','strat_kpis'].includes(realKey)) {
            await this.refreshAdminStratLinks();

            // เคลียร์ช่องกรอก/ตัวเลือกที่เกี่ยวข้อง เพื่อไม่ให้ค้างค่าเดิมหลังลบ
            this.adminResetStratLinkingUI();

            // รีโหลดรายการ Dropdown จากฐานข้อมูลล่าสุด (แก้เคสลบแล้วชื่อยังค้างใน Dropdown)
            await this.fillStratPlanSelect();
        } else {
            await this.loadAdminTable(realKey);
            this.renderAdminTable(realKey);
        }

        // ถ้าลบแถว "ตารางรวม" ให้รีเรนเดอร์ตารางรวมด้วย
        if (key === 'strat_links') this.renderAdminTable('strat_links');

    } catch (e) {
        console.error("adminDelete error", e);
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
    hideLoader() { document.getElementById('loader').classList.add('hidden'); }
};