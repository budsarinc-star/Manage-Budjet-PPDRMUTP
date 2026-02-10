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
            case 'manage': title.innerText = "2. จัดการข้อมูลครุภัณฑ์"; view.innerHTML = UI.managePage(); this.initForm4(); break;
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
            if (subId === 'tab1') this.initForm4();
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


    // =========================
    // Form (ง.4) : Tab 1 Only
    // =========================
    async initForm4() {
        // ป้องกัน: เรียกเฉพาะตอนหน้า (ง.4) render แล้วเท่านั้น
        const deptSel = document.getElementById('f-dept');
        if (!deptSel) return;

        // เติม dropdown master
        await this.form4FillDepts();
        await this.form4FillBudgetSources();
        await this.form4FillCategories();
        await this.form4FillUnits();
        await this.form4FillStratIssue();
        await this.form4FillBscDims();
        await this.form4FillStratKpis();

        // เติม dropdown บูรณาการ (15)
        await this.form4FillIntegrationDropdowns();

        // ผูก event: dept -> branch
        deptSel.onchange = () => this.form4FillBranches(deptSel.value);

        // ตัวนับตัวอักษร
        this.bindCounter('f-obj', 'cnt-obj');
        this.bindCounter('f-strategy', 'cnt-strategy');
        this.bindCounter('f-need', 'cnt-need');
        this.bindCounter('f-objective2', 'cnt-objective2');

        // ตั้งต้นตารางซ่อมบำรุง 2 แถว
        this.form4EnsureRepairRows(2);

        // ตั้งต้น Spec group (19) อย่างน้อย 1 กรุ๊ป
        this.form4EnsureSpecGroups(1);

        // ตัวนับ 22.2
        this.bindCounter('f-note-other-text', 'cnt-note-other');

        // พรีวิวภาพ + check ขนาด (18)
        this.bindImagePreview('f-install-img1', 'prev-install-1', 2);
        this.bindImagePreview('f-install-img2', 'prev-install-2', 2);
        this.bindImagePreview('f-equip-img1', 'prev-equip-1', 2);
        this.bindImagePreview('f-equip-img2', 'prev-equip-2', 2);
        this.bindImagePreview('f-equip-img3', 'prev-equip-3', 2);
        this.bindImagePreview('f-equip-img4', 'prev-equip-4', 2);

        // PDF ขนาดไม่เกิน 10MB
        const pdf = document.getElementById('f-repair-pdf');
        if (pdf) {
            pdf.onchange = () => {
                const f = pdf.files?.[0];
                if (!f) return;
                const max = 10 * 1024 * 1024;
                if (f.size > max) { pdf.value = ''; alert('ไฟล์ PDF ต้องไม่เกิน 10MB'); }
            };
        }

        // PDF ใบเสนอราคา (22.1) ขนาดไม่เกิน 20MB
        const qpdf = document.getElementById('f-quote-pdf');
        if (qpdf) {
            qpdf.onchange = () => {
                const f = qpdf.files?.[0];
                if (!f) return;
                const max = 20 * 1024 * 1024;
                if (f.size > max) { qpdf.value = ''; alert('ไฟล์ PDF (ใบเสนอราคา) ต้องไม่เกิน 20MB'); }
            };
        }

        // hint สิทธิ์ข้อ 10
        const hint = document.getElementById('kpi-role-hint');
        if (hint) {
            const role = currentUser?.role || 'staff_dept';
            hint.classList.toggle('hidden', !(role === 'admin' || role === 'staff_dept'));
        }

        // การวิเคราะห์ครุภัณฑ์ (24) - เฉพาะหน้า (ง.4)
        this.initAnalysisCaseSelector();
        this.initAnalysisCase1UI();

        lucide.createIcons();
    },

    // ---------- Spec (19) ----------
    form4EnsureSpecGroups(n = 1) {
        const box = document.getElementById('f-spec-groups');
        if (!box) return;
        if (box.children.length >= n) return;
        while (box.children.length < n) this.form4AddSpecGroup();
    },

    form4AddSpecGroup(data = {}) {
        const box = document.getElementById('f-spec-groups');
        if (!box) return;
        const idx = box.children.length + 1;
        const unitOptions = document.getElementById('f-kpi-unit')?.innerHTML || '<option value="">เลือกหน่วยนับ</option>';

        const wrap = document.createElement('div');
        wrap.className = 'bg-white p-6 rounded-[1.5rem] border border-indigo-100';
        wrap.dataset.idx = String(idx);
        wrap.innerHTML = `
            <div class="flex items-center justify-between gap-4 mb-4">
                <div class="font-black text-indigo-900">ชื่อรายการประกอบที่ ${idx}</div>
                <button type="button" class="no-print text-rose-600 font-bold text-xs px-3 py-2 rounded-xl border border-rose-100 hover:bg-rose-50" data-act="remove">ลบกรุ๊ป</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div class="md:col-span-5">
                    <label class="text-[11px] font-bold text-gray-500">ชื่อรายการประกอบ</label>
                    <input class="input-flat w-full bg-gray-50 f-spec-name" placeholder="ชื่อรายการประกอบ" value="${data.name || ''}">
                </div>
                <div class="md:col-span-2">
                    <label class="text-[11px] font-bold text-gray-500">จำนวน</label>
                    <input class="input-flat w-full bg-gray-50 f-spec-qty" placeholder="จำนวน" value="${data.qty || ''}">
                </div>
                <div class="md:col-span-2">
                    <label class="text-[11px] font-bold text-gray-500">หน่วยนับ</label>
                    <select class="input-flat w-full bg-gray-50 f-spec-unit">${unitOptions}</select>
                </div>
                <div class="md:col-span-3">
                    <label class="text-[11px] font-bold text-gray-500">ราคาต่อหน่วย (บาท)</label>
                    <input class="input-flat w-full bg-gray-50 f-spec-price" placeholder="บาท" value="${data.price || ''}">
                </div>
            </div>

            <div class="mt-3 flex items-center justify-end gap-3">
                <div class="text-[11px] font-bold text-gray-500">รวมทั้งสิ้น (อัตโนมัติ)</div>
                <input class="input-flat w-56 bg-white f-spec-total" placeholder="บาท" value="${data.total || ''}" readonly>
            </div>

            <div class="mt-5 space-y-2">
                <div class="flex justify-between items-center">
                    <div class="font-bold text-sm text-gray-700">คุณลักษณะ</div>
                    <span class="text-[10px] font-bold text-gray-400"><span class="f-spec-cnt">0</span>/3000</span>
                </div>
                <textarea maxlength="3000" rows="4" class="input-flat w-full f-spec-desc" placeholder="พิมพ์...">${data.desc || ''}</textarea>
            </div>

            <div class="mt-6 space-y-3">
                <div class="font-bold text-sm text-gray-700">เป็นครุภัณฑ์ตามมาตรฐานครุภัณฑ์ดังนี้ (บังคับเลือกได้แค่ 1)</div>
                <div class="space-y-2">
                    <label class="flex items-start gap-3"><input type="radio" name="f-spec-std-${idx}" class="mt-1 accent-indigo-600 f-spec-std" value="std_price"><span class="text-sm">ตัวเลือกที่ 1 บัญชีราคามาตรฐานครุภัณฑ์ สำนักงบประมาณ เดือน <input class="input-flat bg-gray-50 inline-block w-28 mx-1 f-std1-month" placeholder="เดือน"> พ.ศ. <input class="input-flat bg-gray-50 inline-block w-24 mx-1 f-std1-year" placeholder="พ.ศ."> หน้าที่ <input class="input-flat bg-gray-50 inline-block w-24 mx-1 f-std1-page" placeholder="หน้า"></span></label>
                    <label class="flex items-start gap-3"><input type="radio" name="f-spec-std-${idx}" class="mt-1 accent-indigo-600 f-spec-std" value="comp_base"><span class="text-sm">ตัวเลือกที่ 2 เกณฑ์ราคากลางและคุณลักษณะพื้นฐานครุภัณฑ์คอมพิวเตอร์ กระทรวงดิจิทัลฯ ประกาศ ณ วันที่ <input class="input-flat bg-gray-50 inline-block w-40 mx-1 f-std2-date" placeholder="วันที่"> หน้าที่ <input class="input-flat bg-gray-50 inline-block w-24 mx-1 f-std2-page" placeholder="หน้า"></span></label>
                    <label class="flex items-start gap-3"><input type="radio" name="f-spec-std-${idx}" class="mt-1 accent-indigo-600 f-spec-std" value="cctv_base"><span class="text-sm">ตัวเลือกที่ 3 เกณฑ์ราคากลางและคุณลักษณะพื้นฐานของระบบกล้องวงจรปิด กระทรวงดิจิทัลฯ ประกาศ ณ วันที่ <input class="input-flat bg-gray-50 inline-block w-40 mx-1 f-std3-date" placeholder="วันที่"> หน้าที่ <input class="input-flat bg-gray-50 inline-block w-24 mx-1 f-std3-page" placeholder="หน้า"></span></label>
                    <label class="flex items-start gap-3"><input type="radio" name="f-spec-std-${idx}" class="mt-1 accent-indigo-600 f-spec-std" value="other_std"><span class="text-sm">ตัวเลือกที่ 4 มาตรฐานครุภัณฑ์อื่นๆ โปรดระบุ <input class="input-flat bg-gray-50 inline-block w-72 mx-1 f-std4-text" placeholder="ระบุ..."></span></label>
                    <label class="flex items-start gap-3"><input type="radio" name="f-spec-std-${idx}" class="mt-1 accent-indigo-600 f-spec-std" value="off_list"><span class="text-sm">ตัวเลือกที่ 5 นอกบัญชีครุภัณฑ์</span></label>
                </div>
            </div>
        `;

        box.appendChild(wrap);

        // set unit
        const unitSel = wrap.querySelector('.f-spec-unit');
        if (unitSel && data.unit) unitSel.value = data.unit;

        // bind events
        const qty = wrap.querySelector('.f-spec-qty');
        const price = wrap.querySelector('.f-spec-price');
        const desc = wrap.querySelector('.f-spec-desc');
        const cnt = wrap.querySelector('.f-spec-cnt');
        const syncCnt = () => { if (cnt && desc) cnt.innerText = String((desc.value || '').length); };
        if (desc) { desc.oninput = syncCnt; syncCnt(); }
        const recalc = () => this.form4RecalcSpecGroup(wrap);
        if (qty) qty.oninput = recalc;
        if (price) price.oninput = recalc;
        recalc();

        const rm = wrap.querySelector('[data-act="remove"]');
        if (rm) rm.onclick = () => {
            // กันไม่ให้ลบจนเหลือ 0
            if ((document.getElementById('f-spec-groups')?.children?.length || 0) <= 1) return alert('ต้องมีอย่างน้อย 1 กรุ๊ป');
            wrap.remove();
        };

        // เลือกค่ามาตรฐานเดิม (ถ้ามี)
        if (data.stdChoice) {
            const r = wrap.querySelector(`input.f-spec-std[value="${data.stdChoice}"]`);
            if (r) r.checked = true;
        }

        lucide.createIcons();
    },

    form4RecalcSpecGroup(wrap) {
        const qty = (wrap.querySelector('.f-spec-qty')?.value || '').toString().replace(/,/g,'');
        const price = (wrap.querySelector('.f-spec-price')?.value || '').toString().replace(/,/g,'');
        const q = parseFloat(qty);
        const p = parseFloat(price);
        const totalEl = wrap.querySelector('.f-spec-total');
        if (!totalEl) return;
        if (isFinite(q) && isFinite(p)) totalEl.value = String(Math.round(q * p * 100) / 100);
        else totalEl.value = '';
    },

    // ---------- Fill masters ----------
    async form4FillDepts() {
        const sel = document.getElementById('f-dept');
        if (!sel) return;
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('depts').orderBy('name').get();
        sel.innerHTML = '<option value="">เลือกหน่วยงาน</option>' + snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
    },

    async form4FillBranches(deptId) {
        const sel = document.getElementById('f-branch');
        if (!sel) return;
        if (!deptId) { sel.innerHTML = '<option value="">เลือกสาขา/งาน</option>'; return; }

        // โครงสร้างสาขา/งาน: เก็บใน collection 'branches' และมี field deptId
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('branches')
            .where('deptId', '==', deptId).orderBy('name').get().catch(() => null);

        if (!snap) { sel.innerHTML = '<option value="">(ยังไม่มีข้อมูลสาขา/งาน)</option>'; return; }

        sel.innerHTML = '<option value="">เลือกสาขา/งาน</option>' + snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
    },

    async form4FillBudgetSources() {
        const sel = document.getElementById('f-budget-source');
        if (!sel) return;
        // ใช้ master เดิม 'budget_types' เป็นแหล่งเงิน (ไม่กระทบหน้าอื่น)
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('budget_types').orderBy('name').get();
        sel.innerHTML = '<option value="">เลือกแหล่งเงินงบประมาณ</option>' + snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
    },

    async form4FillCategories() {
        const sel = document.getElementById('f-category');
        if (!sel) return;
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('categories').orderBy('name').get();
        sel.innerHTML = '<option value="">เลือกประเภทครุภัณฑ์</option>' + snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
    },

    async form4FillUnits() {
        const unitSel = document.getElementById('f-kpi-unit');
        if (!unitSel) return;
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('units').orderBy('name').get();
        const opts = '<option value="">เลือกหน่วยนับ</option>' + snap.docs.map(d => `<option value="${d.data().name}">${d.data().name}</option>`).join('');
        unitSel.innerHTML = opts;

        ['f-min-std-unit','f-have-total-unit','f-have-ok-unit','f-have-broken-unit'].forEach(id => {
            const s = document.getElementById(id);
            if (s) s.innerHTML = opts;
        });
    },

    async form4FillStratIssue() {
        const sel = document.getElementById('f-strat-issue');
        if (!sel) return;

        // โครงสร้าง: strat_issues (ตั้งต้นในหน้า admin)
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('strat_issues').orderBy('name').get().catch(() => null);
        sel.innerHTML = '<option value="">เลือกประเด็นยุทธศาสตร์</option>' + (snap ? snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('') : '');
    },

    async form4FillBscDims() {
        const sel = document.getElementById('f-bsc-dim');
        if (!sel) return;
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('bsc_dims').orderBy('name').get().catch(() => null);
        sel.innerHTML = '<option value="">เลือกมิติ</option>' + (snap ? snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('') : '');
    },

    async form4FillStratKpis() {
        const sel = document.getElementById('f-strat-kpi');
        if (!sel) return;

        const role = currentUser?.role || 'staff_dept';

        // โครงสร้าง: strat_kpis
        const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('strat_kpis').orderBy('name').get().catch(() => null);

        // เงื่อนไขตามสั่ง: dropdown ข้อ 10 ให้ "admin และ staff_dept" เห็นค่าตั้งต้นของ "admin และ staff_central"
        let docs = snap ? snap.docs : [];
        if (role === 'admin' || role === 'staff_dept') {
            // กรองเฉพาะที่สร้างโดย admin / staff_central (ถ้ามี field createdRole)
            const filtered = docs.filter(d => {
                const r = d.data().createdRole;
                return !r || r === 'admin' || r === 'staff_central';
            });
            if (filtered.length) docs = filtered;
        } else {
            // role อื่น: ซ่อนรายการ (แต่ไม่ซ่อน UI)
            docs = [];
        }

        sel.innerHTML = '<option value="">เลือกตัวชี้วัด (ข้อ 10)</option>' + docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');

        // เลือกแล้วเติมลงตาราง KPI อัตโนมัติ
        sel.onchange = () => {
            const id = sel.value;
            const found = docs.find(x => x.id === id);
            if (!found) return;
            const nameInput = document.getElementById('f-kpi-name');
            if (nameInput) nameInput.value = found.data().name || '';
        };
    },

    async form4FillIntegrationDropdowns() {
        // สาขา/งาน (reuse branches)
        const deptId = document.getElementById('f-dept')?.value || '';
        await this.form4FillBranches(deptId);

        const intBranch = document.getElementById('f-int-branch');
        const intDept = document.getElementById('f-int-dept');
        if (intBranch) intBranch.innerHTML = document.getElementById('f-branch')?.innerHTML || '<option value="">เลือกสาขา/งาน</option>';
        if (intDept) intDept.innerHTML = document.getElementById('f-dept')?.innerHTML || '<option value="">เลือกหน่วยงาน</option>';
    },

    // ---------- Repair table ----------
    form4EnsureRepairRows(n = 2) {
        const body = document.getElementById('f-repair-body');
        if (!body) return;
        if (body.children.length >= n) return;
        while (body.children.length < n) this.form4AddRepairRow();
    },

    form4AddRepairRow(data = {}) {
        const body = document.getElementById('f-repair-body');
        if (!body) return;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-3"><input class="input-flat w-full bg-white f-repair-no" placeholder="เลขที่ครุภัณฑ์" value="${data.no || ''}"></td>
            <td class="px-4 py-3"><input class="input-flat w-full bg-white f-repair-name" placeholder="ชื่อครุภัณฑ์" value="${data.name || ''}"></td>
            <td class="px-4 py-3"><input class="input-flat w-full bg-white f-repair-age" placeholder="อายุการใช้งาน" value="${data.age || ''}"></td>
            <td class="px-4 py-3"><input class="input-flat w-full bg-white f-repair-exp" placeholder="ปีที่หมดอายุ" value="${data.expYear || ''}"></td>
            <td class="px-4 py-3"><input class="input-flat w-full bg-white f-repair-his" placeholder="ประวัติการซ่อม" value="${data.history || ''}"></td>
        `;
        body.appendChild(row);
    },

    // ---------- Save / Reset ----------
    resetForm4() {
        // ล้างเฉพาะฟอร์ม (ง.4)
        const ids = [
            'f4-edit-id','f-budget-other','f-item-name','f-building-name','f-building-year','f-category-other',
            'f-obj','f-strategy','f-need','f-objective2','f-kpi-name','f-kpi-target',
            'f-min-std','f-have-total','f-have-ok','f-have-broken',
            'f-int-branch-count','f-int-dept-count','f-int-knowledge',
            'f-freq-teach-val','f-freq-seminar-val','f-freq-test-val',
            'f-user-teach-val','f-user-seminar-val',
            'f-install-place','f-install-budget','f-install-time',

            // 19-22
            'f-quote-name','f-quote-company','f-note-other-text',
            'f-benefit-ult','f-benefit-ult-unit','f-benefit-ult-2567','f-benefit-ult-2568','f-benefit-ult-2569','f-benefit-ult-2570',
            'f-benefit-out','f-benefit-out-unit','f-benefit-out-2567','f-benefit-out-2568','f-benefit-out-2569','f-benefit-out-2570',
            'f-benefit-prod','f-benefit-prod-unit','f-benefit-prod-2567','f-benefit-prod-2568','f-benefit-prod-2569','f-benefit-prod-2570',
            // 23
            'f-coord-name','f-coord-position','f-coord-phone-office','f-coord-phone-mobile','f-coord-email',
            // 24
            'a1-q1','a1-old-years','a1-q3',
            'a1-q2-2.2','a1-q2-2.3','a1-q2-2.4','a1-q4-4.1','a1-q4-4.2','a1-q5-5.1','a1-q5-5.2','a1-q5-5.3','a1-q5-5.5',
            'a2-q1-1.1','a2-q1-1.2','a2-q2-2.1','a2-q2-2.2','a2-q3-3.1','a2-q3-3.2','a2-q3-3.3','a2-q3-3.4','a2-q4','a2-q5','a2-q6-note',
            'a3-q1','a3-q2','a3-q3-note','a3-q4-note','a3-q5','a3-q6','a3-q7-note',
            'a4-q1','a4-q2-2.1','a4-q2-2.2','a4-q3-note','a4-q4-note','a4-q5','a4-q6','a4-q7-note'
        ];

        // 20 แผนการใช้จ่าย (ต.ค.-ก.ย.)
        const months = ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'];
        months.forEach(m => { ids.push(`f-spend-sign-${m}`, `f-spend-disb-${m}`); });
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

        ['f-dept','f-branch','f-budget-source','f-category','f-strat-issue','f-bsc-dim','f-strat-kpi','f-kpi-unit',
         'f-min-std-unit','f-have-total-unit','f-have-ok-unit','f-have-broken-unit','f-int-branch','f-int-dept'
        ].forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });

        ['f-freq-teach','f-freq-seminar','f-freq-test','f-user-teach','f-user-seminar','f-install-ready','f-install-need-work'].forEach(id => {
            const el = document.getElementById(id); if (el) el.checked = false;
        });

        // clear files + previews
        ['f-repair-pdf','f-install-img1','f-install-img2','f-equip-img1','f-equip-img2','f-equip-img3','f-equip-img4','f-quote-pdf'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        ['prev-install-1','prev-install-2','prev-equip-1','prev-equip-2','prev-equip-3','prev-equip-4'].forEach(id => {
            const img = document.getElementById(id); if (img) { img.src=''; img.classList.add('hidden'); }
        });

        // reset repair table
        const body = document.getElementById('f-repair-body');
        if (body) body.innerHTML = '';
        this.form4EnsureRepairRows(2);

        // reset spec groups
        const specBox = document.getElementById('f-spec-groups');
        if (specBox) specBox.innerHTML = '';
        this.form4EnsureSpecGroups(1);

        // reset spend plan
        ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'].forEach(m => {
            const a = document.getElementById(`f-spend-sign-${m}`);
            const b = document.getElementById(`f-spend-disb-${m}`);
            if (a) a.value = '';
            if (b) b.value = '';
        });

        // reset 22 radios
        const r1 = document.getElementById('f-note-quote');
        const r2 = document.getElementById('f-note-other');
        if (r1) r1.checked = false;
        if (r2) r2.checked = false;

        // reset 24 radios
        document.querySelectorAll('input[name=\"analysis-case\"],input[name=\"a1-q2\"],input[name=\"a1-q4\"],input[name=\"a1-q5\"],input[name=\"a2-q1\"],input[name=\"a2-q2\"],input[name=\"a2-q3\"],input[name=\"a2-q6\"],input[name=\"a3-q3\"],input[name=\"a3-q4\"],input[name=\"a3-q7\"],input[name=\"a4-q2\"],input[name=\"a4-q3\"],input[name=\"a4-q4\"],input[name=\"a4-q7\"]')
            .forEach(el => { el.checked = false; });

        this.initForm4();
    },

    async saveForm4() {
        const deptId = document.getElementById('f-dept')?.value || '';
        const branchId = document.getElementById('f-branch')?.value || '';
        const budgetSourceId = document.getElementById('f-budget-source')?.value || '';
        const itemName = document.getElementById('f-item-name')?.value?.trim() || '';
        const categoryId = document.getElementById('f-category')?.value || '';
        const stratIssueId = document.getElementById('f-strat-issue')?.value || '';
        const bscDimId = document.getElementById('f-bsc-dim')?.value || '';

        // required แบบเบาๆ เฉพาะส่วนที่สร้างไว้แล้ว
        if (!deptId || !branchId || !budgetSourceId || !itemName || !categoryId || !stratIssueId || !bscDimId) {
            return alert('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบ');
        }
        const analysisCase = document.querySelector('input[name="analysis-case"]:checked')?.value || '';
        if (!analysisCase) return alert('กรุณาเลือกกรณีการวิเคราะห์ครุภัณฑ์ (ข้อ 24)');


        // เก็บ rows ซ่อมบำรุง
        const repairRows = [...document.querySelectorAll('#f-repair-body tr')].map(tr => ({
            no: tr.querySelector('.f-repair-no')?.value || '',
            name: tr.querySelector('.f-repair-name')?.value || '',
            age: tr.querySelector('.f-repair-age')?.value || '',
            expYear: tr.querySelector('.f-repair-exp')?.value || '',
            history: tr.querySelector('.f-repair-his')?.value || ''
        })).filter(r => Object.values(r).some(v => (v || '').toString().trim() !== ''));

        // validate images size and required counts
        const imgIds = ['f-install-img1','f-install-img2','f-equip-img1','f-equip-img2','f-equip-img3','f-equip-img4'];
        const files = Object.fromEntries(imgIds.map(id => [id, document.getElementById(id)?.files?.[0] || null]));
        const missingRequired = ['f-install-img1','f-install-img2','f-equip-img1','f-equip-img2','f-equip-img3','f-equip-img4'].some(id => !files[id]);
        if (missingRequired) return alert('ข้อ 18 ต้องแนบรูปให้ครบ: สถานที่ติดตั้ง 2 รูป และครุภัณฑ์ 4 รูป');

        const maxImg = 2 * 1024 * 1024;
        for (const [id, f] of Object.entries(files)) {
            if (f && f.size > maxImg) return alert('ไฟล์รูปต้องไม่เกิน 2MB/ภาพ');
        }

        const pdfFile = document.getElementById('f-repair-pdf')?.files?.[0] || null;
        if (pdfFile && pdfFile.size > 10 * 1024 * 1024) return alert('ไฟล์ PDF ต้องไม่เกิน 10MB');

        // PDF ใบเสนอราคา 20MB
        const quotePdf = document.getElementById('f-quote-pdf')?.files?.[0] || null;
        if (quotePdf && quotePdf.size > 20 * 1024 * 1024) return alert('ไฟล์ PDF (ใบเสนอราคา) ต้องไม่เกิน 20MB');

        // Spec groups (19)
        const specGroups = [...document.querySelectorAll('#f-spec-groups > div')].map(div => {
            const idx = div.dataset.idx || '';
            const stdChoice = div.querySelector(`input[name="f-spec-std-${idx}"]:checked`)?.value || '';
            return {
                name: div.querySelector('.f-spec-name')?.value || '',
                qty: div.querySelector('.f-spec-qty')?.value || '',
                unit: div.querySelector('.f-spec-unit')?.value || '',
                price: div.querySelector('.f-spec-price')?.value || '',
                total: div.querySelector('.f-spec-total')?.value || '',
                desc: div.querySelector('.f-spec-desc')?.value || '',
                stdChoice,
                std1: { month: div.querySelector('.f-std1-month')?.value || '', year: div.querySelector('.f-std1-year')?.value || '', page: div.querySelector('.f-std1-page')?.value || '' },
                std2: { date: div.querySelector('.f-std2-date')?.value || '', page: div.querySelector('.f-std2-page')?.value || '' },
                std3: { date: div.querySelector('.f-std3-date')?.value || '', page: div.querySelector('.f-std3-page')?.value || '' },
                std4: { text: div.querySelector('.f-std4-text')?.value || '' }
            };
        }).filter(g => {
            const basics = [g.name, g.qty, g.unit, g.price, g.total, g.desc, g.stdChoice, g.std1?.month, g.std1?.year, g.std1?.page, g.std2?.date, g.std2?.page, g.std3?.date, g.std3?.page, g.std4?.text];
            return basics.some(v => (v || '').toString().trim() !== '');
        });

        // Spend plan (20)
        const months = ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'];
        const spendPlan = {
            sign: Object.fromEntries(months.map(m => [m, document.getElementById(`f-spend-sign-${m}`)?.value || '' ])),
            disburse: Object.fromEntries(months.map(m => [m, document.getElementById(`f-spend-disb-${m}`)?.value || '' ]))
        };

        // Benefits (21)
        const benefits = {
            ultimate: {
                text: document.getElementById('f-benefit-ult')?.value || '',
                unit: document.getElementById('f-benefit-ult-unit')?.value || '',
                y2567: document.getElementById('f-benefit-ult-2567')?.value || '',
                y2568: document.getElementById('f-benefit-ult-2568')?.value || '',
                y2569: document.getElementById('f-benefit-ult-2569')?.value || '',
                y2570: document.getElementById('f-benefit-ult-2570')?.value || ''
            },
            outcome: {
                text: document.getElementById('f-benefit-out')?.value || '',
                unit: document.getElementById('f-benefit-out-unit')?.value || '',
                y2567: document.getElementById('f-benefit-out-2567')?.value || '',
                y2568: document.getElementById('f-benefit-out-2568')?.value || '',
                y2569: document.getElementById('f-benefit-out-2569')?.value || '',
                y2570: document.getElementById('f-benefit-out-2570')?.value || ''
            },
            output: {
                text: document.getElementById('f-benefit-prod')?.value || '',
                unit: document.getElementById('f-benefit-prod-unit')?.value || '',
                y2567: document.getElementById('f-benefit-prod-2567')?.value || '',
                y2568: document.getElementById('f-benefit-prod-2568')?.value || '',
                y2569: document.getElementById('f-benefit-prod-2569')?.value || '',
                y2570: document.getElementById('f-benefit-prod-2570')?.value || ''
            }
        };

        // Notes (22)
        const noteType = document.querySelector('input[name="f-note-type"]:checked')?.value || '';
        const notes = {
            type: noteType,
            quote: { name: document.getElementById('f-quote-name')?.value || '', company: document.getElementById('f-quote-company')?.value || '' },
            other: { text: document.getElementById('f-note-other-text')?.value || '' }
        };


// Coordinator (23)
const coordinator = {
    name: document.getElementById('f-coord-name')?.value || '',
    position: document.getElementById('f-coord-position')?.value || '',
    phoneOffice: document.getElementById('f-coord-phone-office')?.value || '',
    phoneMobile: document.getElementById('f-coord-phone-mobile')?.value || '',
    email: document.getElementById('f-coord-email')?.value || ''
};

// Analysis (24)
const analysis = { case: analysisCase, data: {} };

if (analysisCase === '1') {
    analysis.data = {
        q1: document.getElementById('a1-q1')?.value || '',
        oldYears: document.getElementById('a1-old-years')?.value || '',
        q2Choice: document.querySelector('input[name="a1-q2"]:checked')?.value || '',
        q2_22: document.getElementById('a1-q2-2.2')?.value || '',
        q2_23: document.getElementById('a1-q2-2.3')?.value || '',
        q2_24: document.getElementById('a1-q2-2.4')?.value || '',
        q3: document.getElementById('a1-q3')?.value || '',
        q4Choice: document.querySelector('input[name="a1-q4"]:checked')?.value || '',
        q4_41: document.getElementById('a1-q4-4.1')?.value || '',
        q4_42: document.getElementById('a1-q4-4.2')?.value || '',
        q5Choice: document.querySelector('input[name="a1-q5"]:checked')?.value || '',
        q5_51: document.getElementById('a1-q5-5.1')?.value || '',
        q5_52: document.getElementById('a1-q5-5.2')?.value || '',
        q5_53: document.getElementById('a1-q5-5.3')?.value || '',
        q5_55: document.getElementById('a1-q5-5.5')?.value || ''
    };
}
if (analysisCase === '2') {
    analysis.data = {
        q1Choice: document.querySelector('input[name="a2-q1"]:checked')?.value || '',
        q1_11: document.getElementById('a2-q1-1.1')?.value || '',
        q1_12: document.getElementById('a2-q1-1.2')?.value || '',
        q2Choice: document.querySelector('input[name="a2-q2"]:checked')?.value || '',
        q2_21: document.getElementById('a2-q2-2.1')?.value || '',
        q2_22: document.getElementById('a2-q2-2.2')?.value || '',
        q3Choice: document.querySelector('input[name="a2-q3"]:checked')?.value || '',
        q3_31: document.getElementById('a2-q3-3.1')?.value || '',
        q3_32: document.getElementById('a2-q3-3.2')?.value || '',
        q3_33: document.getElementById('a2-q3-3.3')?.value || '',
        q3_34: document.getElementById('a2-q3-3.4')?.value || '',
        q4: document.getElementById('a2-q4')?.value || '',
        q5: document.getElementById('a2-q5')?.value || '',
        q6Choice: document.querySelector('input[name="a2-q6"]:checked')?.value || '',
        q6Note: document.getElementById('a2-q6-note')?.value || ''
    };
}
if (analysisCase === '3') {
    analysis.data = {
        q1: document.getElementById('a3-q1')?.value || '',
        q2: document.getElementById('a3-q2')?.value || '',
        q3Choice: document.querySelector('input[name="a3-q3"]:checked')?.value || '',
        q3Note: document.getElementById('a3-q3-note')?.value || '',
        q4Choice: document.querySelector('input[name="a3-q4"]:checked')?.value || '',
        q4Note: document.getElementById('a3-q4-note')?.value || '',
        q5: document.getElementById('a3-q5')?.value || '',
        q6: document.getElementById('a3-q6')?.value || '',
        q7Choice: document.querySelector('input[name="a3-q7"]:checked')?.value || '',
        q7Note: document.getElementById('a3-q7-note')?.value || ''
    };
}
if (analysisCase === '4') {
    analysis.data = {
        q1: document.getElementById('a4-q1')?.value || '',
        q2Choice: document.querySelector('input[name="a4-q2"]:checked')?.value || '',
        q2_21: document.getElementById('a4-q2-2.1')?.value || '',
        q2_22: document.getElementById('a4-q2-2.2')?.value || '',
        q3Choice: document.querySelector('input[name="a4-q3"]:checked')?.value || '',
        q3Note: document.getElementById('a4-q3-note')?.value || '',
        q4Choice: document.querySelector('input[name="a4-q4"]:checked')?.value || '',
        q4Note: document.getElementById('a4-q4-note')?.value || '',
        q5: document.getElementById('a4-q5')?.value || '',
        q6: document.getElementById('a4-q6')?.value || '',
        q7Choice: document.querySelector('input[name="a4-q7"]:checked')?.value || '',
        q7Note: document.getElementById('a4-q7-note')?.value || ''
    };
}

        // payload
        const payload = {
            deptId,
            branchId,
            budgetSourceId,
            budgetOther: document.getElementById('f-budget-other')?.value || '',
            itemName,
            building: {
                name: document.getElementById('f-building-name')?.value || '',
                year: document.getElementById('f-building-year')?.value || ''
            },
            categoryId,
            categoryOther: document.getElementById('f-category-other')?.value || '',
            stratIssueId,
            objectiveStrategic: document.getElementById('f-obj')?.value || '',
            strategyAlign: document.getElementById('f-strategy')?.value || '',
            bscDimId,
            stratKpiId: document.getElementById('f-strat-kpi')?.value || '',
            kpi: {
                name: document.getElementById('f-kpi-name')?.value || '',
                unit: document.getElementById('f-kpi-unit')?.value || '',
                target: document.getElementById('f-kpi-target')?.value || ''
            },
            needReason: document.getElementById('f-need')?.value || '',
            objective2: document.getElementById('f-objective2')?.value || '',
            minStandard: {
                std: document.getElementById('f-min-std')?.value || '',
                stdUnit: document.getElementById('f-min-std-unit')?.value || '',
                haveTotal: document.getElementById('f-have-total')?.value || '',
                haveTotalUnit: document.getElementById('f-have-total-unit')?.value || '',
                haveOk: document.getElementById('f-have-ok')?.value || '',
                haveOkUnit: document.getElementById('f-have-ok-unit')?.value || '',
                haveBroken: document.getElementById('f-have-broken')?.value || '',
                haveBrokenUnit: document.getElementById('f-have-broken-unit')?.value || ''
            },
            repairHistory: repairRows,
            integration: {
                branchCount: document.getElementById('f-int-branch-count')?.value || '',
                branchId: document.getElementById('f-int-branch')?.value || '',
                deptCount: document.getElementById('f-int-dept-count')?.value || '',
                deptId: document.getElementById('f-int-dept')?.value || '',
                knowledge: document.getElementById('f-int-knowledge')?.value || ''
            },
            frequency: {
                teach: { checked: !!document.getElementById('f-freq-teach')?.checked, value: document.getElementById('f-freq-teach-val')?.value || '' },
                seminar: { checked: !!document.getElementById('f-freq-seminar')?.checked, value: document.getElementById('f-freq-seminar-val')?.value || '' },
                test: { checked: !!document.getElementById('f-freq-test')?.checked, value: document.getElementById('f-freq-test-val')?.value || '' }
            },
            users: {
                teach: { checked: !!document.getElementById('f-user-teach')?.checked, value: document.getElementById('f-user-teach-val')?.value || '' },
                seminar: { checked: !!document.getElementById('f-user-seminar')?.checked, value: document.getElementById('f-user-seminar-val')?.value || '' }
            },
            install: {
                place: document.getElementById('f-install-place')?.value || '',
                ready: !!document.getElementById('f-install-ready')?.checked,
                needWork: !!document.getElementById('f-install-need-work')?.checked,
                budget: document.getElementById('f-install-budget')?.value || '',
                time: document.getElementById('f-install-time')?.value || ''
            },

            // 19-22
            specificationGroups: specGroups,
            spendPlan,
            benefits,
            notes,
            coordinator,
            analysis,
            createdBy: currentUser?.name || '',
            createdRole: currentUser?.role || '',
            createdDept: currentUser?.dept || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        this.showLoader();

        // create / update doc
        const editId = document.getElementById('f4-edit-id')?.value || '';
        const colRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('form4_records');
        const docRef = editId ? colRef.doc(editId) : colRef.doc();
        await docRef.set(payload, { merge: true });

        // upload files to Storage (ต้องมี firebase-storage)
        const urls = {};
        const basePath = `artifacts/${appId}/form4/${docRef.id}`;

        // images
        for (const [id, file] of Object.entries(files)) {
            if (!file) continue;
            const key = id.replace('f-','');
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const ref = storage.ref().child(`${basePath}/${key}.${ext}`);
            await ref.put(file);
            urls[key] = await ref.getDownloadURL();
        }

        // pdf
        if (pdfFile) {
            const refPdf = storage.ref().child(`${basePath}/repair.pdf`);
            await refPdf.put(pdfFile);
            urls.repairPdf = await refPdf.getDownloadURL();
        }

        // quote pdf (22.1)
        if (quotePdf) {
            const refPdf2 = storage.ref().child(`${basePath}/quote.pdf`);
            await refPdf2.put(quotePdf);
            urls.quotePdf = await refPdf2.getDownloadURL();
        }

        if (Object.keys(urls).length) await docRef.set({ fileUrls: urls, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

        document.getElementById('f4-edit-id').value = docRef.id;
        alert('บันทึก (ง.4) เรียบร้อย');
        this.hideLoader();
    },

    // ---------- UI helpers for this form ----------
    bindCounter(textareaId, counterId) {
        const el = document.getElementById(textareaId);
        const c = document.getElementById(counterId);
        if (!el || !c) return;
        const sync = () => c.innerText = (el.value || '').length;
        el.oninput = sync;
        sync();
    },

    bindImagePreview(inputId, imgId, maxMb = 2) {
        const inp = document.getElementById(inputId);
        const img = document.getElementById(imgId);
        if (!inp || !img) return;
        inp.onchange = () => {
            const f = inp.files?.[0];
            if (!f) { img.src = ''; img.classList.add('hidden'); return; }
            const max = maxMb * 1024 * 1024;
            if (f.size > max) { inp.value=''; img.src=''; img.classList.add('hidden'); return alert(`ไฟล์รูปต้องไม่เกิน ${maxMb}MB`); }
            const url = URL.createObjectURL(f);
            img.src = url;
            img.classList.remove('hidden');
        };
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
