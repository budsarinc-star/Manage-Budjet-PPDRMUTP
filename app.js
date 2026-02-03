// --- ตัวแปรหลัก ---
var currentUser = { name: "แอดมิน สูงสุด", role: "admin", dept: "กองนโยบายและแผน" };
var appId = "budget-manage-v001";
var tableState = { page: 1, limit: 10, currentType: 'budget_types', fullData: [], searchQuery: '' };
var analysisState = { page: 1, limit: 10, fullData: [], searchQuery: '' };

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

function handleLogin() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('u-name-display').innerText = currentUser.name;
    document.getElementById('u-dept-display').innerText = currentUser.dept;
    App.navigate('dashboard');
}

const App = {
    navigate(pageId) {
        const view = document.getElementById('content-view');
        const title = document.getElementById('page-title');
        UI.renderSidebar(pageId, currentUser.role);
        switch(pageId) {
            case 'dashboard': title.innerText = "1. Dashboard"; view.innerHTML = UI.dashboardPage(); break;
            case 'manage': title.innerText = "2. จัดการข้อมูลครุภัณฑ์"; view.innerHTML = UI.managePage(); break;
            case 'admin': title.innerText = "3. ผู้ดูแลระบบ"; view.innerHTML = UI.adminPage(); this.loadMasterTable(); this.fillUserDeptSelect(); this.initAdminSetup(); break;
        }
        lucide.createIcons();
    },

    switchSubTab(page, subId) {
        const view = document.getElementById('content-view');
        if (page === 'admin') {
            view.innerHTML = UI.adminPage(subId);
            if (subId === 'tab1') { this.loadMasterTable(); this.initAdminSetup(); }
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
        document.getElementById(inputId).value = ''; this.loadMasterTable(); this.hideLoader();
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
    },

    // --- หมวดข้อมูลยุทธศาสตร์และตัวชี้วัด (ความสัมพันธ์ 9-12) ---
    initStratLinkingUI() {
        const s10 = document.getElementById('strat-parent-10'); // plans
        const s11 = document.getElementById('strat-parent-11'); // issues
        const s12 = document.getElementById('strat-parent-12'); // bsc

        // ถ้า UI ยังไม่ render (ไม่ได้อยู่หน้า admin tab1) ก็ข้าม
        if (!s10 || !s11 || !s12) return;

        // เติมฉบับแผน
        this.fillStratPlanSelect();

        // เมื่อเปลี่ยนฉบับแผน -> เติมยุทธศาสตร์
        s10.onchange = async () => {
            await this.fillStratIssueSelect(s10.value);
            // reset มิติ
            await this.fillBscSelect(s11.value);
        };

        // เมื่อเปลี่ยนยุทธศาสตร์ -> เติมมิติ
        s11.onchange = async () => {
            await this.fillBscSelect(s11.value);
        };
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
                this.hideLoader();
                return;
            }

            if (level === 11) {
                const issueId = document.getElementById('strat-parent-11')?.value || '';
                const name = (document.getElementById('strat-lvl-11')?.value || '').trim();
                if (!issueId) return alert("กรุณาเลือกยุทธศาสตร์");
                if (!name) return alert("กรุณาระบุข้อมูล");
                this.showLoader();
                await db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('bsc_dims')
                    .add({ issueId, name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
                document.getElementById('strat-lvl-11').value = '';
                alert("เชื่อมโยงสำเร็จ");
                await this.fillBscSelect(issueId);
                this.hideLoader();
                return;
            }

            if (level === 12) {
                const bscId = document.getElementById('strat-parent-12')?.value || '';
                const name = (document.getElementById('strat-lvl-12')?.value || '').trim();
                if (!bscId) return alert("กรุณาเลือกมิติ");
                if (!name) return alert("กรุณาระบุข้อมูล");
                this.showLoader();
                await db.collection('artifacts').doc(appId).collection('public').doc('data')
                    .collection('strat_kpis')
                    .add({ bscId, name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser?.name || '' });
                document.getElementById('strat-lvl-12').value = '';
                alert("เชื่อมโยงสำเร็จ");
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

        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('strat_plans').orderBy('createdAt', 'desc').get();

        sel.innerHTML = '<option value="">เลือกฉบับที่</option>' + snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');

        // auto chain
        const planId = sel.value || (snap.docs[0]?.id || '');
        if (planId && !sel.value) sel.value = planId;
        await this.fillStratIssueSelect(sel.value);
    },

    async fillStratIssueSelect(planId) {
        const sel = document.getElementById('strat-parent-11');
        if (!sel) return;

        if (!planId) {
            sel.innerHTML = '<option value="">เลือกยุทธศาสตร์</option>';
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
        await this.fillBscSelect(sel.value);
    },

    async fillBscSelect(issueId) {
        const sel = document.getElementById('strat-parent-12');
        if (!sel) return;

        if (!issueId) {
            sel.innerHTML = '<option value="">เลือกมิติ</option>';
            return;
        }

        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data')
            .collection('bsc_dims').where('issueId', '==', issueId).get();

        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

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

    // ฟังก์ชันเดิมของโครงสร้างองค์กร
    async saveBranch() {
       alert("เชื่อมโยงสำเร็จ");
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
        const userData = {
            username: document.getElementById('u-user').value.trim(),
            password: document.getElementById('u-pass').value.trim(),
            fullname: document.getElementById('u-fullname').value.trim(),
            role: document.getElementById('u-role').value,
            position: document.getElementById('u-pos').value.trim(),
            dept: document.getElementById('u-dept-select').value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if(!userData.username || !userData.password) return alert("กรอกข้อมูลสำคัญด้วยจ้า");
        this.showLoader();
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users').add(userData);
        this.resetUserForm(); this.loadUserTable(); this.hideLoader();
    },

    async loadUserTable() {
        const tbody = document.getElementById('user-list-body');
        if (!tbody) return;
        this.showLoader();
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users').get();
        tbody.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `
            <tr class="hover:bg-purple-50/30 transition-all">
                <td class="px-6 py-4 font-bold text-indigo-600">${d.username}</td>
                <td class="px-6 py-4 font-mono text-purple-700 tracking-wider">${d.password}</td> 
                <td class="px-6 py-4">${d.fullname}</td>
                <td class="px-6 py-4 text-center"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold">${d.role}</span></td>
                <td class="px-6 py-4">${d.position}</td>
                <td class="px-6 py-4">${d.dept}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button class="text-amber-500 hover:bg-amber-50 p-2 rounded-lg transition-all"><i data-lucide="edit-3" size="18"></i></button>
                        <button class="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"><i data-lucide="trash-2" size="18"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        lucide.createIcons();
        this.hideLoader();
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
    resetUserForm() { document.getElementById('u-user').value = ""; document.getElementById('u-pass').value = ""; document.getElementById('u-fullname').value = ""; },
    showLoader() { document.getElementById('loader').classList.remove('hidden'); },
    hideLoader() { document.getElementById('loader').classList.add('hidden'); }
};
