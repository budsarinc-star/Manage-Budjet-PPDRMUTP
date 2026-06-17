const UI = {
    renderSidebar(activeId, role) {
        const nav = document.getElementById('sidebar-nav');
        const menus = [
            { id: 'dashboard', label: '1. Dashboard', icon: 'layout-dashboard', roles: ['admin', 'manager', 'staff_central', 'staff_dept'] },
            { id: 'manage', label: '2. จัดการข้อมูลครุภัณฑ์', icon: 'package', roles: ['admin', 'staff_central', 'staff_dept'] },
            { id: 'admin', label: '3. ผู้ดูแลระบบ', icon: 'shield-check', roles: ['admin'] }
        ];
        nav.innerHTML = menus.filter(m => m.roles.includes(role)).map(m => `
            <button onclick="App.navigate('${m.id}')" class="w-full flex items-center gap-3 p-4 rounded-2xl transition-all hover:bg-white/10 group ${activeId === m.id ? 'menu-active' : ''}">
                <i data-lucide="${m.icon}" class="w-5 h-5 ${activeId === m.id ? 'text-white' : 'text-purple-300'}"></i>
                <span class="font-bold text-sm ${activeId === m.id ? 'text-white' : 'text-gray-300'}">${m.label}</span>
            </button>`).join('');
        lucide.createIcons();
    },

    dashboardPage(subTab = 'overview') {
        return `<div class="animate-in fade-in duration-500">
            <div class="flex gap-4 mb-8 no-print">
                <button onclick="App.switchSubTab('dashboard', 'overview')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-indigo-50'}">ภาพรวมหน่วยงาน</button>
                <button onclick="App.switchSubTab('dashboard', 'compare')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'compare' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-indigo-50'}">ข้อมูลเปรียบเทียบระหว่างปีงบประมาณ</button>
            </div>
            ${subTab === 'overview' ? this.dashboardOverviewTemplate() : this.dashboardCompareTemplate()}
        </div>
<!-- Admin Edit Modal Root (เฉพาะหน้า ตั้งต้นข้อมูล) -->
<div id="admin-edit-modal" class="hidden"></div>`;
    },

    dashboardOverviewTemplate() {
        return `<div class="space-y-6">
            <div class="card-main p-6 flex flex-wrap md:flex-nowrap gap-4 items-end bg-white shadow-sm border-indigo-50">
                <div class="flex-1 space-y-1.5"><label class="text-[10px] font-bold text-gray-400 uppercase">ประเภทเงินงบประมาณ</label><select id="dash-budget-type" class="input-flat w-full bg-gray-50 font-bold text-xs"></select></div>
                <div class="flex-1 space-y-1.5"><label class="text-[10px] font-bold text-gray-400 uppercase">ชื่อหน่วยงาน</label><select id="dash-dept-name" class="input-flat w-full bg-gray-50 font-bold text-xs"></select></div>
                <div class="flex-1 space-y-1.5"><label class="text-[10px] font-bold text-gray-400 uppercase">ปีงบประมาณ</label><select id="dash-year" class="input-flat w-full bg-gray-50 font-bold text-xs"></select></div>
                <div class="flex gap-2"><button onclick="App.loadDashboardData()" class="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2"><i data-lucide="play" size="14"></i> แสดงผลข้อมูล</button><button onclick="location.reload()" class="bg-gray-100 text-gray-500 p-3 rounded-xl hover:bg-gray-200"><i data-lucide="refresh-cw" size="18"></i></button></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="card-main p-8 border-l-8 border-indigo-500"><p class="text-xs font-bold text-gray-400 uppercase mb-2">งบประมาณรวมทั้งสิ้น</p><div class="flex items-baseline gap-2"><span class="text-3xl font-black text-indigo-950">฿ 125,400,000</span></div><p class="mt-2 text-[10px] font-bold"><span class="text-red-500"><i data-lucide="trending-up" class="inline w-3 h-3"></i> +12%</span><span class="text-gray-400 ml-1">จากปีที่แล้ว</span></p></div>
                <div class="card-main p-8 border-l-8 border-purple-500"><p class="text-xs font-bold text-gray-400 uppercase mb-2">จำนวนรายการ</p><span class="text-3xl font-black text-indigo-950">452</span><span class="text-sm font-bold text-gray-400 ml-2">ชิ้น</span></div>
                <div class="card-main p-8 border-l-8 border-emerald-500 flex flex-col justify-between"><p class="text-xs font-bold text-gray-400 uppercase mb-2">สัดส่วนระหว่างงบประมาณ</p><div class="flex gap-2"><div class="flex-1 h-2 bg-emerald-600 rounded-full"></div><div class="flex-1 h-2 bg-emerald-200 rounded-full"></div></div><div class="flex justify-between text-[10px] font-bold mt-2"><span class="text-emerald-700">งบแผ่นดิน (70%)</span><span class="text-emerald-300">งบรายได้ (30%)</span></div></div>
            </div>
            <div class="space-y-6"><div class="card-main p-8"><h5 class="font-bold text-sm text-gray-500 mb-6 flex items-center gap-2"><i data-lucide="bar-chart-big" size="16"></i> งบประมาณแยกตามหน่วยงาน</h5><canvas id="deptBudgetChart" height="200"></canvas></div><div class="card-main p-8"><h5 class="font-bold text-sm text-gray-500 mb-6 flex items-center gap-2"><i data-lucide="pie-chart" size="16"></i> สัดส่วนประเภทครุภัณฑ์</h5><canvas id="catPieChart" height="200"></canvas></div></div>
            <div class="card-main overflow-hidden border-white shadow-sm"><table class="w-full text-left"><thead class="table-header"><tr><th class="px-6 py-4">หน่วยงาน</th><th class="px-6 py-4">ประเภทเงิน</th><th class="px-6 py-4">ปีงบประมาณ</th><th class="px-6 py-4">สาขา/งาน</th><th class="px-6 py-4">รายการ</th><th class="px-6 py-4 text-right">จำนวนเงิน</th></tr></thead><tbody id="dash-table-body" class="divide-y divide-gray-50 text-sm"></tbody></table></div>
        </div>
<!-- Admin Edit Modal Root (เฉพาะหน้า ตั้งต้นข้อมูล) -->
<div id="admin-edit-modal" class="hidden"></div>`;
    },

    dashboardCompareTemplate() {
        return `<div class="space-y-10"><section class="space-y-6"><div class="flex items-center gap-3 border-b-2 border-indigo-100 pb-2"><div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">1</div><h4 class="font-black text-indigo-900 text-lg">ข้อมูล 5 ปีงบประมาณย้อนหลัง</h4></div><div class="card-main p-6 flex flex-wrap gap-4 items-end bg-indigo-50/30"><div class="w-64 space-y-1.5"><label class="text-[10px] font-bold text-gray-400">หน่วยงาน</label><select id="comp-dept-1" class="input-flat w-full bg-white text-xs"></select></div><div class="w-64 space-y-1.5"><label class="text-[10px] font-bold text-gray-400">ประเภทเงินงบประมาณ</label><select id="comp-budget-1" class="input-flat w-full bg-white text-xs"></select></div><div class="flex-1 space-y-1.5"><label class="text-[10px] font-bold text-gray-400">ช่วงปีงบประมาณ</label><div class="flex items-center gap-2"><select id="year-start" class="input-flat flex-1 bg-white text-xs"></select><span class="text-gray-400 text-xs font-bold">ถึง</span><select id="year-end" class="input-flat flex-1 bg-white text-xs"></select></div></div><button onclick="App.loadCompareChart()" class="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2"><i data-lucide="bar-chart" size="14"></i> แสดงข้อมูล</button></div><div class="card-main p-10 bg-white"><canvas id="timeSeriesLineChart" height="120"></canvas></div></section><section class="space-y-6"><div class="flex items-center gap-3 border-b-2 border-purple-100 pb-2"><div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">2</div><h4 class="font-black text-purple-900 text-lg">ข้อมูลเปรียบเทียบระหว่างปีงบประมาณ</h4></div><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="space-y-1.5"><label class="text-[10px] font-bold text-gray-400 ml-2">หน่วยงาน</label><select id="comp-dept-2" class="input-flat w-full bg-white text-sm"></select></div><div class="space-y-1.5"><label class="text-[10px] font-bold text-gray-400 ml-2">ประเภทเงินงบประมาณ</label><select id="comp-budget-2" class="input-flat w-full bg-white text-sm"></select></div><div class="space-y-1.5"><label class="text-[10px] font-bold text-gray-400 ml-2 text-purple-600">* เลือกปีที่ต้องการเทียบ</label><div class="flex items-center gap-2"><select id="comp-year-a" class="input-flat flex-1 bg-white text-sm border-purple-200"></select><span class="text-gray-300 font-bold">VS</span><select id="comp-year-b" class="input-flat flex-1 bg-white text-sm border-purple-200"></select></div></div></div><div class="flex justify-center mt-4"><button onclick="App.runComparison()" class="bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3"><i data-lucide="columns" size="20"></i> เปรียบเทียบข้อมูล</button></div></section></div>
<!-- Admin Edit Modal Root (เฉพาะหน้า ตั้งต้นข้อมูล) -->
<div id="admin-edit-modal" class="hidden"></div>`;
    },

    managePage(subTab = 'tab1') {
        return `<div class="animate-in fade-in duration-500">
            <div class="flex gap-4 mb-8 no-print">
                <button onclick="App.switchSubTab('manage', 'tab1')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab1' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500'}">(ง.4)</button>
                <button onclick="App.switchSubTab('manage', 'tab2')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab2' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500'}">(ง.5)</button>
                <button onclick="App.switchSubTab('manage', 'tab3')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab3' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500'}">(ง.6)</button>
            </div>
            ${subTab === 'tab1' ? this.manageForm4Template() : `<div class="card-main p-20 text-center text-gray-300 italic">อยู่ระหว่างรอดำเนินการ</div>`}
        </div>
<!-- Admin Edit Modal Root (เฉพาะหน้า ตั้งต้นข้อมูล) -->
<div id="admin-edit-modal" class="hidden"></div>`;
    },

    manageForm4Template() {
        return `<div class="card-main p-12 bg-white relative print:p-0 print:shadow-none form4-page">
            <!-- Print-only form code (top-right on paper) -->
            <div class="print-only form4-print-code">แบบ ง.4</div>

            <div class="flex flex-col md:flex-row justify-between items-start gap-4 mb-10 no-print">
                <div>
                    <h3 class="text-indigo-900 font-black text-2xl">(ง.4) รายละเอียดคำชี้แจงรายการครุภัณฑ์</h3>
                    <p class="text-[11px] text-gray-400 font-bold mt-1">ข้อมูล <span class="text-red-500">*</span> สีแดง คือบังคับกรอกข้อมูล</p>
                </div>
                <div class="flex gap-2 items-center">
                    <input type="hidden" id="f4-edit-id">
                    <div class="text-right pr-1 text-[11px] font-bold text-gray-500">แบบ ง.4</div>
                </div>
            </div>

            <!-- หัวข้อกลาง -->
            <div class="text-center mb-10 form4-header">
                <img src="logo.png" class="w-20 mx-auto mb-4" alt="RMUTP Logo">
                <h4 class="font-bold text-xl">มหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร</h4>
                <h5 class="font-bold text-lg text-slate-500">รายละเอียดคำชี้แจงค่าครุภัณฑ์</h5>
            </div>

            <div class="space-y-6">

                <!-- ══ SECTION A: ข้อมูลพื้นฐาน ══ -->
                <div class="space-y-0 rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm">

                    <!-- แถว 1: ปีงบประมาณ | หน่วยงาน | สาขา/งาน -->
                    <div class="grid grid-cols-3 divide-x divide-gray-100 bg-white">
                        <div class="f4-cell">
                            <label class="f4-cell-label">ปีงบประมาณ <span class="text-red-500">*</span></label>
                            <select id="f-year" class="f4-cell-input"></select>
                        </div>
                        <div class="f4-cell">
                            <label class="f4-cell-label">หน่วยงาน <span class="text-red-500">*</span></label>
                            <select id="f-dept" class="f4-cell-input"></select>
                        </div>
                        <div class="f4-cell">
                            <label class="f4-cell-label">สาขา / งาน <span class="text-red-500">*</span></label>
                            <select id="f-branch" class="f4-cell-input"></select>
                        </div>
                    </div>

                    <!-- แถว 2: แหล่งเงินงบประมาณ | อื่นๆ (เต็มแถว) -->
                    <div class="grid grid-cols-[1fr_1fr] divide-x divide-gray-100 bg-gray-50/50 border-t border-gray-100">
                        <div class="f4-cell">
                            <label class="f4-cell-label">แหล่งเงินงบประมาณ <span class="text-red-500">*</span></label>
                            <select id="f-budget-source" class="f4-cell-input"></select>
                        </div>
                        <div class="f4-cell">
                            <label class="f4-cell-label text-gray-400">อื่นๆ โปรดระบุ</label>
                            <input id="f-budget-other" placeholder="โปรดระบุ (กรณีเลือกอื่นๆ)" class="f4-cell-input">
                        </div>
                    </div>

                    <!-- แถว 3: ประเภทครุภัณฑ์ (+ textarea) | ชื่อรายการ + รายการ -->
                    <div class="grid grid-cols-2 divide-x divide-gray-100 bg-white border-t border-gray-100 items-start">
                        <div class="f4-cell space-y-2">
                            <label class="f4-cell-label">ประเภทครุภัณฑ์ <span class="text-red-500">*</span></label>
                            <select id="f-category" class="f4-cell-input"></select>
                            <textarea id="f-building-note" rows="2" class="f4-cell-input text-xs bg-amber-50 border border-amber-200 text-amber-800 placeholder-amber-400 rounded-xl px-3 py-2 w-full resize-none" placeholder="เฉพาะครุภัณฑ์ประกอบอาคาร โปรดกรอกข้อมูลเพิ่มเติม"></textarea>
                        </div>
                        <div class="f4-cell space-y-2">
                            <div>
                                <label class="f4-cell-label">รายการ <span class="text-red-500">*</span></label>
                                <select id="f-item" class="f4-cell-input"></select>
                            </div>
                            <div>
                                <label class="f4-cell-label">ชื่อรายการ <span class="text-red-500">*</span></label>
                                <input id="f-item-desc" placeholder="ระบุ เช่น คอมพิวเตอร์ / ชุดห้องปฏิบัติการ ฯลฯ" class="f4-cell-input">
                            </div>
                        </div>
                    </div>

                    <!-- hidden fields เก็บค่าเดิม -->
                    <input id="f-building-name" class="hidden" />
                    <input id="f-building-year" class="hidden" />
                </div>

                <!-- ══ SECTION B: ความสอดคล้องยุทธศาสตร์ ══ -->
                <div class="space-y-3" id="f-strat-section">
                    <div class="text-xs font-bold text-red-500 flex items-center gap-2">
                        <i data-lucide="target" size="13"></i>
                        * ความสอดคล้องกับประเด็นยุทธศาสตร์ / กลยุทธ์ / มิติ และ ตัวชี้วัดความสำเร็จตามแผนพัฒนามหาวิทยาลัย
                    </div>

                    <!-- Cascade Step-by-Step: ตารางกริด 7 step -->
                    <div class="rounded-[1.5rem] border border-indigo-100 overflow-hidden shadow-sm">

                        <!-- Step 1: แผนพัฒนา -->
                        <div class="f4-strat-row bg-white">
                            <div class="f4-strat-badge bg-indigo-600 text-white">1</div>
                            <div class="f4-strat-label">แผนพัฒนามหาวิทยาลัย</div>
                            <div class="f4-strat-field">
                                <select id="f-plan" class="f4-strat-select" onchange="App.f4CascadeStep('plan')">
                                    <option value="">— เลือกฉบับแผน —</option>
                                </select>
                            </div>
                        </div>

                        <!-- Step 2: ประเด็นยุทธศาสตร์ -->
                        <div class="f4-strat-row bg-indigo-50/30 border-t border-indigo-50">
                            <div class="f4-strat-badge bg-indigo-500 text-white">2</div>
                            <div class="f4-strat-label">ประเด็นยุทธศาสตร์</div>
                            <div class="f4-strat-field">
                                <select id="f-issue" class="f4-strat-select" disabled onchange="App.f4CascadeStep('issue')">
                                    <option value="">— เลือกฉบับแผนก่อน —</option>
                                </select>
                            </div>
                        </div>

                        <!-- Step 3: วัตถุประสงค์ -->
                        <div class="f4-strat-row bg-white border-t border-indigo-50">
                            <div class="f4-strat-badge bg-indigo-400 text-white">3</div>
                            <div class="f4-strat-label">วัตถุประสงค์เชิงยุทธศาสตร์</div>
                            <div class="f4-strat-field">
                                <select id="f-strategy" class="f4-strat-select" disabled onchange="App.f4CascadeStep('strategy')">
                                    <option value="">— เลือกประเด็นก่อน —</option>
                                </select>
                            </div>
                        </div>

                        <!-- Step 4: กลยุทธ์ -->
                        <div class="f4-strat-row bg-indigo-50/30 border-t border-indigo-50">
                            <div class="f4-strat-badge bg-purple-500 text-white">4</div>
                            <div class="f4-strat-label">กลยุทธ์</div>
                            <div class="f4-strat-field">
                                <select id="f-dimension" class="f4-strat-select" disabled onchange="App.f4CascadeStep('dimension')">
                                    <option value="">— เลือกวัตถุประสงค์ก่อน —</option>
                                </select>
                            </div>
                        </div>

                        <!-- Step 5: กลยุทธ์ย่อย -->
                        <div class="f4-strat-row bg-white border-t border-indigo-50">
                            <div class="f4-strat-badge bg-purple-400 text-white">5</div>
                            <div class="f4-strat-label">กลยุทธ์ย่อย <span class="text-[10px] font-normal text-gray-400">(ถ้ามี)</span></div>
                            <div class="f4-strat-field">
                                <select id="f-substrategy" class="f4-strat-select" disabled onchange="App.f4CascadeStep('substrategy')">
                                    <option value="">— เลือกกลยุทธ์ก่อน —</option>
                                </select>
                            </div>
                        </div>

                        <!-- Step 6: มิติ -->
                        <div class="f4-strat-row bg-indigo-50/30 border-t border-indigo-50">
                            <div class="f4-strat-badge bg-emerald-500 text-white">6</div>
                            <div class="f4-strat-label">มิติ (BSC)</div>
                            <div class="f4-strat-field">
                                <select id="f-kpidim" class="f4-strat-select" disabled onchange="App.f4CascadeStep('kpidim')">
                                    <option value="">— เลือกกลยุทธ์ก่อน —</option>
                                </select>
                            </div>
                        </div>

                        <!-- Step 7: ตัวชี้วัด (สีเขียวเน้น) -->
                        <div class="f4-strat-row bg-emerald-50/40 border-t border-emerald-100">
                            <div class="f4-strat-badge bg-emerald-600 text-white">7</div>
                            <div class="f4-strat-label font-black text-emerald-800">ตัวชี้วัด (KPI)</div>
                            <div class="f4-strat-field">
                                <select id="f-kpi" class="f4-strat-select border-emerald-200 bg-emerald-50/60" disabled>
                                    <option value="">— เลือกมิติก่อน —</option>
                                </select>
                            </div>
                        </div>

                    </div><!-- end cascade grid -->

                    <!-- ตารางตัวชี้วัด (+ - แถว) -->
                    <div class="card-main p-6 bg-indigo-50/20 border border-indigo-100 rounded-[1.5rem] overflow-hidden">
                        <div class="flex justify-between items-center mb-3">
                            <div class="text-[11px] font-bold text-gray-500">ตัวชี้วัดตามแผนพัฒนามหาวิทยาลัยฯ <span class="text-gray-400 font-normal">(เพิ่มได้หลายแถว)</span></div>
                            <div class="flex items-center gap-2 no-print">
                                <button onclick="App.form4RemoveKpiRows()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2">
                                    <i data-lucide="minus" size="16"></i> ลบแถว
                                </button>
                                <button onclick="App.form4AddKpiRow()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2">
                                    <i data-lucide="plus" size="16"></i> เพิ่มแถว
                                </button>
                            </div>
                        </div>
                        <div class="overflow-auto">
                            <table class="w-full text-left text-sm min-w-[760px]">
                                <thead class="table-header">
                                    <tr class="bg-indigo-50/40">
                                        <th class="px-4 py-3 w-14 text-center">เลือก</th>
                                        <th class="px-4 py-3">ตัวชี้วัด</th>
                                        <th class="px-4 py-3 w-52">หน่วยนับ</th>
                                        <th class="px-4 py-3 w-52">จำนวน</th>
                                    </tr>
                                </thead>
                                <tbody id="f-kpi-rows" class="divide-y divide-indigo-100"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- 11-14 (ยังคงเพื่อให้ flow ต่อเนื่องก่อนถึง 15-18) -->
                <div class="space-y-8">
                    <div class="space-y-1.5">
                        <div class="flex justify-between items-center">
                            <label class="text-xs font-bold text-red-500">* เหตุผลความจำเป็น</label>
                            <span class="text-[10px] font-bold text-gray-400"><span id="cnt-need">0</span>/3000</span>
                        </div>
                        <textarea id="f-need" maxlength="3000" rows="6" class="input-flat w-full" placeholder="โปรดระบุ ..."></textarea>
                    </div>

                    <div class="space-y-1.5">
                        <div class="flex justify-between items-center">
                            <label class="text-xs font-bold text-red-500">* วัตถุประสงค์ (ควรระบุสิ่งที่ต้องการทำให้สำเร็จเท่านั้น)</label>
                            <span class="text-[10px] font-bold text-gray-400"><span id="cnt-objective2">0</span>/3000</span>
                        </div>
                        <textarea id="f-objective2" maxlength="3000" rows="4" class="input-flat w-full" placeholder="โปรดระบุ..."></textarea>
                    </div>

                    <div class="space-y-3">
                        <label class="text-xs font-bold text-red-500">*13. มาตรฐานขั้นต่ำที่ควรมี</label>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="flex gap-2 items-center">
                                <span class="text-xs font-bold text-gray-600 w-40">มาตรฐานขั้นต่ำ</span>
                                <input id="f-min-std" class="input-flat flex-1 bg-white" placeholder="ระบุ...">
                                <select id="f-min-std-unit" class="input-flat w-40 bg-white"></select>
                            </div>
                            <div class="flex gap-2 items-center">
                                <span class="text-xs font-bold text-gray-600 w-40">มีอยู่แล้ว จำนวน</span>
                                <input id="f-have-total" class="input-flat flex-1 bg-white" placeholder="จำนวน">
                                <select id="f-have-total-unit" class="input-flat w-40 bg-white"></select>
                            </div>
                            <div class="flex gap-2 items-center">
                                <span class="text-xs font-bold text-gray-600 w-40">ใช้การได้ จำนวน</span>
                                <input id="f-have-ok" class="input-flat flex-1 bg-white" placeholder="จำนวน">
                                <select id="f-have-ok-unit" class="input-flat w-40 bg-white"></select>
                            </div>
                            <div class="flex gap-2 items-center">
                                <span class="text-xs font-bold text-gray-600 w-40">ชำรุด จำนวน</span>
                                <input id="f-have-broken" class="input-flat flex-1 bg-white" placeholder="จำนวน">
                                <select id="f-have-broken-unit" class="input-flat w-40 bg-white"></select>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <label class="text-xs font-bold">14. ตารางประวัติการซ่อมบำรุงรักษาครุภัณฑ์ <span class="text-[10px] text-gray-400 font-bold">(กรณีขอรับจัดสรรเพื่อทดแทนของเดิมที่ชำรุด)</span></label>

                        <div class="card-main p-6 bg-white border border-indigo-50 rounded-[1.5rem] overflow-hidden">
                            <div class="flex justify-between items-center no-print mb-4">
                                <div class="text-[11px] font-bold text-gray-500">ตั้งต้น 2 แถว สามารถกด + เพิ่มได้</div>
                                <button onclick="App.form4AddRepairRow()" class="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2">
                                    <i data-lucide="plus" size="16"></i> เพิ่มแถว
                                </button>
                            </div>

                            <div class="overflow-auto">
                                <table class="w-full text-left text-sm min-w-[900px]">
                                    <thead class="table-header">
                                        <tr class="bg-indigo-50/40">
                                            <th class="px-4 py-3">เลขที่ครุภัณฑ์</th>
                                            <th class="px-4 py-3">ชื่อครุภัณฑ์</th>
                                            <th class="px-4 py-3">อายุการใช้งาน</th>
                                            <th class="px-4 py-3">ปีที่หมดอายุครุภัณฑ์</th>
                                            <th class="px-4 py-3">ประวัติการซ่อม</th>
                                        </tr>
                                    </thead>
                                    <tbody id="f-repair-body" class="divide-y divide-gray-100"></tbody>
                                </table>
                            </div>

                            <div class="mt-4 space-y-2">
                                <p class="text-[11px] font-bold text-gray-500">แนบบัญชีคุมครุภัณฑ์ / ประวัติการซ่อมแซมด้วย</p>
                                <div class="flex items-center gap-3">
                                    <input id="f-repair-pdf" type="file" accept="application/pdf" class="text-xs">
                                    <span class="text-[10px] font-bold text-gray-400">*แนบไฟล์ PDF ขนาดไม่เกิน 10MB</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 15-18 : ทำต่อชุดนี้ -->
                <div class="space-y-8">
                    <!-- 15 -->
                    <div class="space-y-3">
                        <label class="text-xs font-bold">15. บูรณาการในการใช้งานของครุภัณฑ์</label>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-bold text-gray-500">จำนวน สาขาวิชา</label>
                                <input id="f-int-branch-count" class="input-flat w-full bg-white" placeholder="จำนวน">
                            </div>
                            <div class="space-y-1.5 md:col-span-2">
                                <label class="text-[11px] font-bold text-gray-500">สาขา (ระบุสาขาวิชาที่บูรณาการ)</label>
                                <select id="f-int-branch" class="input-flat w-full bg-white"></select>
                            </div>

                            <div class="space-y-1.5">
                                <label class="text-[11px] font-bold text-gray-500">จำนวน หน่วยงาน</label>
                                <input id="f-int-dept-count" class="input-flat w-full bg-white" placeholder="จำนวน">
                            </div>
                            <div class="space-y-1.5 md:col-span-2">
                                <label class="text-[11px] font-bold text-gray-500">หน่วยงาน (โปรดระบุหน่วยงานที่บูรณาการ)</label>
                                <select id="f-int-dept" class="input-flat w-full bg-white"></select>
                            </div>

                            <div class="space-y-1.5 md:col-span-3">
                                <label class="text-[11px] font-bold text-gray-500">จำนวน องค์ความรู้ที่นำมาบูรณาการ (ถ้ามี) ประกอบด้วย</label>
                                <input id="f-int-knowledge" class="input-flat w-full bg-white" placeholder="ระบุ...">
                            </div>
                        </div>
                    </div>

                    <!-- 16 -->
                    <div class="space-y-3">
                        <label class="text-xs font-bold text-red-500">*16. ความถี่ในการใช้งาน (ติ๊กได้มากกว่า 1)</label>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label class="flex items-center gap-3 bg-white p-4 rounded-2xl border border-indigo-100 cursor-pointer">
                                <input id="f-freq-teach" type="checkbox" class="accent-indigo-600">
                                <div class="flex-1">
                                    <div class="font-bold text-xs text-gray-700 mb-2">การเรียนการสอน</div>
                                    <div class="flex items-center gap-2">
                                        <input id="f-freq-teach-val" class="input-flat flex-1 bg-gray-50" placeholder="จำนวนครั้ง">
                                        <span class="text-xs font-bold text-gray-500">ครั้ง/สัปดาห์</span>
                                    </div>
                                </div>
                            </label>

                            <label class="flex items-center gap-3 bg-white p-4 rounded-2xl border border-indigo-100 cursor-pointer">
                                <input id="f-freq-seminar" type="checkbox" class="accent-indigo-600">
                                <div class="flex-1">
                                    <div class="font-bold text-xs text-gray-700 mb-2">อบรม / สัมมนา</div>
                                    <div class="flex items-center gap-2">
                                        <input id="f-freq-seminar-val" class="input-flat flex-1 bg-gray-50" placeholder="จำนวนครั้ง">
                                        <span class="text-xs font-bold text-gray-500">ครั้ง/ปี</span>
                                    </div>
                                </div>
                            </label>

                            <label class="flex items-center gap-3 bg-white p-4 rounded-2xl border border-indigo-100 cursor-pointer">
                                <input id="f-freq-test" type="checkbox" class="accent-indigo-600">
                                <div class="flex-1">
                                    <div class="font-bold text-xs text-gray-700 mb-2">ทดลอง / ทดสอบให้การรับรองมาตรฐาน</div>
                                    <div class="flex items-center gap-2">
                                        <input id="f-freq-test-val" class="input-flat flex-1 bg-gray-50" placeholder="จำนวนครั้ง">
                                        <span class="text-xs font-bold text-gray-500">ครั้ง/เดือน</span>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- 17 -->
                    <div class="space-y-3">
                        <label class="text-xs font-bold text-red-500">*17. จำนวนผู้ใช้งาน (ติ๊กได้มากกว่า 1)</label>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label class="flex items-center gap-3 bg-white p-4 rounded-2xl border border-indigo-100 cursor-pointer">
                                <input id="f-user-teach" type="checkbox" class="accent-indigo-600">
                                <div class="flex-1">
                                    <div class="font-bold text-xs text-gray-700 mb-2">การเรียนการสอน</div>
                                    <div class="flex items-center gap-2">
                                        <input id="f-user-teach-val" class="input-flat flex-1 bg-gray-50" placeholder="จำนวนคน">
                                        <span class="text-xs font-bold text-gray-500">คน/ครั้ง</span>
                                    </div>
                                </div>
                            </label>

                            <label class="flex items-center gap-3 bg-white p-4 rounded-2xl border border-indigo-100 cursor-pointer">
                                <input id="f-user-seminar" type="checkbox" class="accent-indigo-600">
                                <div class="flex-1">
                                    <div class="font-bold text-xs text-gray-700 mb-2">อบรม / สัมมนา</div>
                                    <div class="flex items-center gap-2">
                                        <input id="f-user-seminar-val" class="input-flat flex-1 bg-gray-50" placeholder="จำนวนคน">
                                        <span class="text-xs font-bold text-gray-500">คน/ครั้ง</span>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- 18 -->
                    <div class="space-y-4">
                        <label class="text-xs font-bold text-red-500">*18. สถานที่ติดตั้งครุภัณฑ์</label>

                        <div class="space-y-3">
                            <div class="flex flex-col md:flex-row gap-3 md:items-center">
                                <span class="text-xs font-bold text-gray-600 w-44">สถานที่ (โปรดระบุ)</span>
                                <input id="f-install-place" class="input-flat flex-1 bg-white" placeholder="ระบุสถานที่ติดตั้ง...">
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label class="flex items-start gap-3 bg-white p-4 rounded-2xl border border-indigo-100 cursor-pointer">
                                    <input id="f-install-ready" type="checkbox" class="accent-indigo-600 mt-1">
                                    <div class="flex-1">
                                        <div class="font-bold text-xs text-gray-700">พร้อมติดตั้งครุภัณฑ์ทันที</div>
                                    </div>
                                </label>

                                <label class="flex items-start gap-3 bg-white p-4 rounded-2xl border border-indigo-100 cursor-pointer">
                                    <input id="f-install-need-work" type="checkbox" class="accent-indigo-600 mt-1">
                                    <div class="flex-1 space-y-2">
                                        <div class="font-bold text-xs text-gray-700">ต้องปรับปรุง / ก่อสร้างใหม่ก่อนติดตั้งครุภัณฑ์</div>
                                        <div class="flex flex-col md:flex-row gap-2">
                                            <input id="f-install-budget" class="input-flat flex-1 bg-gray-50" placeholder="งบประมาณ (บาท)">
                                            <input id="f-install-time" class="input-flat flex-1 bg-gray-50" placeholder="ระบุช่วงเวลา">
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div class="space-y-3">
                                <div class="font-bold text-xs text-gray-700">*สถานที่ติดตั้ง 2 รูป (ต้องมี) <span class="text-[10px] text-gray-400 font-bold">ขนาดไม่เกิน 2MB/ภาพ</span></div>
                                <div class="flex flex-col md:flex-row gap-4">
                                    <div class="flex-1">
                                        <input id="f-install-img1" type="file" accept="image/*" class="text-xs">
                                        <img id="prev-install-1" class="mt-2 w-full h-44 object-cover rounded-2xl border border-gray-100 hidden" />
                                    </div>
                                    <div class="flex-1">
                                        <input id="f-install-img2" type="file" accept="image/*" class="text-xs">
                                        <img id="prev-install-2" class="mt-2 w-full h-44 object-cover rounded-2xl border border-gray-100 hidden" />
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-3">
                                <div class="font-bold text-xs text-gray-700">*ครุภัณฑ์ที่ต้องการจัดซื้อ 4 รูป (ต้องมี) <span class="text-[10px] text-gray-400 font-bold">ขนาดไม่เกิน 2MB/ภาพ</span></div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <input id="f-equip-img1" type="file" accept="image/*" class="text-xs">
                                        <img id="prev-equip-1" class="mt-2 w-full h-44 object-cover rounded-2xl border border-gray-100 hidden" />
                                    </div>
                                    <div>
                                        <input id="f-equip-img2" type="file" accept="image/*" class="text-xs">
                                        <img id="prev-equip-2" class="mt-2 w-full h-44 object-cover rounded-2xl border border-gray-100 hidden" />
                                    </div>
                                    <div>
                                        <input id="f-equip-img3" type="file" accept="image/*" class="text-xs">
                                        <img id="prev-equip-3" class="mt-2 w-full h-44 object-cover rounded-2xl border border-gray-100 hidden" />
                                    </div>
                                    <div>
                                        <input id="f-equip-img4" type="file" accept="image/*" class="text-xs">
                                        <img id="prev-equip-4" class="mt-2 w-full h-44 object-cover rounded-2xl border border-gray-100 hidden" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 19-22 : ทำต่อชุดนี้ -->
                <div class="space-y-10">
                    <!-- 19 -->
                    <div class="space-y-3">
                        <label class="text-xs font-bold">19. คุณลักษณะเฉพาะ (Specification)</label>
                        <p class="text-[11px] text-gray-400 font-bold">(กรณีจัดซื้อ ครุภัณฑ์เป็นชุดที่มีรายการย่อย ต้องระบุ จำนวน และราคาต่อหน่วยของรายการย่อยด้วย)</p>

                        <div class="card-main p-6 bg-white border border-indigo-50 rounded-[1.5rem] overflow-hidden">
                            <div class="flex justify-between items-center no-print mb-4">
                                <div class="text-[11px] font-bold text-gray-500">ฟอร์มตั้งต้นเป็นกรุ๊ป (กด + เพื่อเพิ่มชื่อรายการประกอบถัดไป)</div>
                                <button onclick="App.form4AddSpecGroup()" class="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2">
                                    <i data-lucide="plus" size="16"></i> เพิ่มกรุ๊ป
                                </button>
                            </div>

                            <div id="f-spec-groups" class="space-y-6"></div>
                        </div>
                    </div>

                    <!-- 20 -->
                    <div class="space-y-3">
                        <label class="text-xs font-bold">20. แผนการใช้จ่ายงบประมาณ (หน่วย : ล้านบาท ทศนิยม 3 ตำแหน่ง)</label>
                        <div class="card-main p-6 bg-white border border-indigo-50 rounded-[1.5rem] overflow-hidden">
                            <div class="overflow-auto">
                                <table class="w-full text-left text-sm min-w-[1100px]">
                                    <thead class="table-header">
                                        <tr class="bg-indigo-50/40">
                                            <th class="px-4 py-3">รายการ</th>
                                            <th class="px-3 py-3">ต.ค.</th>
                                            <th class="px-3 py-3">พ.ย.</th>
                                            <th class="px-3 py-3">ธ.ค.</th>
                                            <th class="px-3 py-3">ม.ค.</th>
                                            <th class="px-3 py-3">ก.พ.</th>
                                            <th class="px-3 py-3">มี.ค.</th>
                                            <th class="px-3 py-3">เม.ย.</th>
                                            <th class="px-3 py-3">พ.ค.</th>
                                            <th class="px-3 py-3">มิ.ย.</th>
                                            <th class="px-3 py-3">ก.ค.</th>
                                            <th class="px-3 py-3">ส.ค.</th>
                                            <th class="px-3 py-3">ก.ย.</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100">
                                        <tr>
                                            <td class="px-4 py-3 font-bold text-gray-600">ลงนามสัญญา</td>
                                            ${['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'].map(m => `<td class="px-2 py-2"><input id="f-spend-sign-${m}" class="input-flat w-24 bg-white" placeholder="0.000"></td>`).join('')}
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-3 font-bold text-gray-600">เบิกจ่ายเงิน</td>
                                            ${['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'].map(m => `<td class="px-2 py-2"><input id="f-spend-disb-${m}" class="input-flat w-24 bg-white" placeholder="0.000"></td>`).join('')}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- 21 -->
                    <div class="space-y-3">
                        <label class="text-xs font-bold">21. การบริหารจัดการเพื่อให้เกิดประโยชน์ตามวัตถุประสงค์ (ผลที่คาดว่าจะได้รับ ระยะ 5 ปีแรก)</label>
                        <div class="card-main p-6 bg-white border border-indigo-50 rounded-[1.5rem] overflow-hidden">
                            <div class="overflow-auto">
                                <table class="w-full text-left text-sm min-w-[1000px]">
                                    <thead class="table-header">
                                        <tr class="bg-indigo-50/40">
                                            <th class="px-4 py-3">ผลที่คาดว่าจะได้รับ</th>
                                            <th class="px-4 py-3">หน่วยนับ</th>
                                            <th class="px-4 py-3">ปี งปม. 2567</th>
                                            <th class="px-4 py-3">ปี งปม. 2568</th>
                                            <th class="px-4 py-3">ปี งปม. 2569</th>
                                            <th class="px-4 py-3">ปี งปม. 2570</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100">
                                        <tr>
                                            <td class="px-4 py-3"><input id="f-benefit-ult" class="input-flat w-full bg-white" placeholder="ผลลัพธ์บั้นปลาย (Ultimate Outcome)"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-ult-unit" class="input-flat w-full bg-white" placeholder="หน่วยนับ"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-ult-2567" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-ult-2568" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-ult-2569" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-ult-2570" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-3"><input id="f-benefit-out" class="input-flat w-full bg-white" placeholder="ผลลัพธ์ (Outcome)"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-out-unit" class="input-flat w-full bg-white" placeholder="หน่วยนับ"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-out-2567" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-out-2568" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-out-2569" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-out-2570" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-3"><input id="f-benefit-prod" class="input-flat w-full bg-white" placeholder="ผลผลิตของโครงการ (Output)"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-prod-unit" class="input-flat w-full bg-white" placeholder="หน่วยนับ"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-prod-2567" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-prod-2568" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-prod-2569" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                            <td class="px-4 py-3"><input id="f-benefit-prod-2570" class="input-flat w-full bg-white" placeholder="ค่า"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- 22 -->
                    <div class="space-y-3">
                        <label class="text-xs font-bold">22. คำชี้แจงอื่นๆ เพื่อประกอบคำพิจารณา</label>

                        <div class="card-main p-6 bg-white border border-indigo-50 rounded-[1.5rem] space-y-6">
                            <div class="space-y-2">
                                <label class="flex items-start gap-3 cursor-pointer">
                                    <input type="radio" name="f-note-type" id="f-note-quote" class="mt-1 accent-indigo-600" value="quote">
                                    <div class="flex-1">
                                        <div class="font-bold text-sm">22.1 ใบเสนอราคา</div>
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                            <input id="f-quote-name" class="input-flat w-full bg-gray-50" placeholder="ใบเสนอราคา...">
                                            <input id="f-quote-company" class="input-flat w-full bg-gray-50" placeholder="บริษัท...">
                                        </div>
                                        <div class="mt-3 flex items-center gap-3">
                                            <input id="f-quote-pdf" type="file" accept="application/pdf" class="text-xs">
                                            <span class="text-[10px] font-bold text-red-500">* ปุ่มแนบไฟล์ ขนาดไม่เกิน 20MB แบบ PDF เท่านั้น</span>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div class="space-y-2">
                                <label class="flex items-start gap-3 cursor-pointer">
                                    <input type="radio" name="f-note-type" id="f-note-other" class="mt-1 accent-indigo-600" value="other">
                                    <div class="flex-1">
                                        <div class="flex justify-between items-center">
                                            <div class="font-bold text-sm">22.2 คำชี้แจงอื่น</div>
                                            <span class="text-[10px] font-bold text-gray-400"><span id="cnt-note-other">0</span>/3000</span>
                                        </div>
                                        <textarea id="f-note-other-text" maxlength="3000" rows="5" class="input-flat w-full mt-3" placeholder="พิมพ์..."></textarea>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                
<!-- 23 -->
<div class="space-y-3">
    <label class="text-xs font-bold">23. ข้อมูลผู้ประสานงานโครงการ</label>
    <div class="card-main p-6 bg-white border border-indigo-50 rounded-[1.5rem]">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
                <label class="text-[11px] font-bold text-gray-500">ชื่อ - สกุล</label>
                <input id="f-coord-name" class="input-flat w-full bg-gray-50" placeholder="ชื่อ - สกุล">
            </div>
            <div class="space-y-1.5">
                <label class="text-[11px] font-bold text-gray-500">ตำแหน่ง</label>
                <input id="f-coord-position" class="input-flat w-full bg-gray-50" placeholder="ตำแหน่ง">
            </div>
            <div class="space-y-1.5">
                <label class="text-[11px] font-bold text-gray-500">เบอร์โทรศัพท์ที่ทำงาน</label>
                <input id="f-coord-phone-office" class="input-flat w-full bg-gray-50" placeholder="เบอร์โทรศัพท์ที่ทำงาน">
            </div>
            <div class="space-y-1.5">
                <label class="text-[11px] font-bold text-gray-500">โทรศัพท์มือถือ</label>
                <input id="f-coord-phone-mobile" class="input-flat w-full bg-gray-50" placeholder="โทรศัพท์มือถือ">
            </div>
            <div class="space-y-1.5 md:col-span-2">
                <label class="text-[11px] font-bold text-gray-500">E-mail Address</label>
                <input id="f-coord-email" class="input-flat w-full bg-gray-50" placeholder="E-mail Address">
            </div>
        </div>
    </div>
</div>

<!-- 24 -->
<div class="space-y-4">
    <label class="text-xs font-bold">การวิเคราะห์ครุภัณฑ์ตามวัตถุประสงค์ (ผนวก ค.แนวทางการวิเคราะห์งบลงทุน (ครุภัณฑ์))</label>
    <p class="text-[11px] text-gray-400 font-bold">ตัวเลือกบังคับเลือก 1 กรณี จาก 4 กรณี (เลือกแล้วจะแสดงเฉพาะกรณีที่เลือก)</p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
        <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
            <input type="radio" name="analysis-case" value="1" class="accent-indigo-600" onchange="App.switchAnalysisCase(1)">
            <span class="font-bold text-sm text-indigo-900">กรณีที่ 1 ทดแทนของเดิม (เพื่อรักษาปริมาณผลผลิต)</span>
        </label>
        <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
            <input type="radio" name="analysis-case" value="2" class="accent-indigo-600" onchange="App.switchAnalysisCase(2)">
            <span class="font-bold text-sm text-indigo-900">กรณีที่ 2 เพิ่มปริมาณเป้าหมายผลผลิต</span>
        </label>
        <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
            <input type="radio" name="analysis-case" value="3" class="accent-indigo-600" onchange="App.switchAnalysisCase(3)">
            <span class="font-bold text-sm text-indigo-900">กรณีที่ 3 เพิ่มคุณภาพ/ประสิทธิภาพ/ประสิทธิผล</span>
        </label>
        <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
            <input type="radio" name="analysis-case" value="4" class="accent-indigo-600" onchange="App.switchAnalysisCase(4)">
            <span class="font-bold text-sm text-indigo-900">กรณีที่ 4 เพิ่มผลผลิตใหม่</span>
        </label>
    </div>

    <div id="analysis-case-hint" class="card-main p-6 bg-white border border-indigo-50 rounded-[1.5rem] text-sm text-gray-400 font-bold hidden">
        โปรดเลือก 1 กรณีด้านบนเพื่อแสดงแบบฟอร์มการวิเคราะห์
    </div>

    <!-- Case 1 -->
    <div id="analysis-case-1" class="card-main p-8 bg-white border border-indigo-50 rounded-[1.5rem] space-y-6 hidden">
        <div class="font-black text-indigo-900 text-lg">กรณีที่ 1 : ทดแทนของเดิม</div>

        <div class="space-y-2">
            <div class="font-bold text-sm">ข้อ 1 ระบุความจำเป็นที่ต้องจัดหาเพื่อทดแทนครุภัณฑ์เดิม</div>
            <textarea id="a1-q1" class="input-flat w-full" rows="4" placeholder="อธิบาย..."></textarea>
        </div>

        <div class="space-y-3">
            <div class="font-bold text-sm">ข้อ 2 สภาพการใช้งานครุภัณฑ์เดิม (จำนวนปีที่ใช้งาน / ประวัติการซ่อมแซม)</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input id="a1-old-years" class="input-flat w-full bg-gray-50" placeholder="จำนวนปีที่ใช้งาน / รายละเอียดโดยย่อ">
                <div class="space-y-2">
                    <label class="flex items-start gap-3"><input type="radio" name="a1-q2" value="2.1" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q2','2.1')"><span class="text-sm">2.1 ใช้งานได้สมบูรณ์</span></label>
                    <label class="flex items-start gap-3"><input type="radio" name="a1-q2" value="2.2" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q2','2.2')"><span class="text-sm">2.2 ใช้งานได้บางส่วนแต่ไม่สมบูรณ์</span></label>
                    <label class="flex items-start gap-3"><input type="radio" name="a1-q2" value="2.3" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q2','2.3')"><span class="text-sm">2.3 ไม่สามารถใช้งานได้</span></label>
                    <label class="flex items-start gap-3"><input type="radio" name="a1-q2" value="2.4" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q2','2.4')"><span class="text-sm">2.4 อื่นๆ</span></label>
                </div>
            </div>
            <textarea id="a1-q2-2.2" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (2.2) ..."></textarea>
            <textarea id="a1-q2-2.3" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (2.3) ..."></textarea>
            <textarea id="a1-q2-2.4" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (2.4) ..."></textarea>
        </div>

        <div class="space-y-2">
            <div class="font-bold text-sm">ข้อ 3 สัดส่วนจำนวนกลุ่มเป้าหมาย ต่อจำนวนครุภัณฑ์ (เปรียบเทียบก่อนและหลัง)</div>
            <textarea id="a1-q3" class="input-flat w-full" rows="4" placeholder="อธิบาย..."></textarea>
        </div>

        <div class="space-y-3">
            <div class="font-bold text-sm">ข้อ 4 สามารถใช้งานครุภัณฑ์ร่วมกับส่วนราชการอื่น</div>
            <label class="flex items-start gap-3"><input type="radio" name="a1-q4" value="4.1" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q4','4.1')"><span class="text-sm">4.1 ได้</span></label>
            <textarea id="a1-q4-4.1" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (4.1) ..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a1-q4" value="4.2" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q4','4.2')"><span class="text-sm">4.2 ไม่ได้ เนื่องจาก</span></label>
            <textarea id="a1-q4-4.2" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (4.2) ..."></textarea>
        </div>

        <div class="space-y-3">
            <div class="font-bold text-sm">ข้อ 5 สรุปทางเลือกการจัดหาครุภัณฑ์ใหม่ทดแทนของเดิม</div>
            <label class="flex items-start gap-3"><input type="radio" name="a1-q5" value="5.1" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q5','5.1')"><span class="text-sm">5.1 ใช้ครุภัณฑ์เดิมได้ ไม่ต้องจัดหาใหม่</span></label>
            <textarea id="a1-q5-5.1" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (5.1) ..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a1-q5" value="5.2" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q5','5.2')"><span class="text-sm">5.2 ใช้ครุภัณฑ์เดิมได้ แต่ต้องปรับปรุง/ซ่อมแซม</span></label>
            <textarea id="a1-q5-5.2" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (5.2) ..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a1-q5" value="5.3" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q5','5.3')"><span class="text-sm">5.3 ใช้ไม่ได้/ไม่คุ้มซ่อม ต้องจัดหาใหม่</span></label>
            <textarea id="a1-q5-5.3" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (5.3) ..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a1-q5" value="5.4" class="mt-1 accent-indigo-600"><span class="text-sm">5.4 ขาดการยืนยันข้อมูล ควรตรวจสอบ/ทบทวนใหม่</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a1-q5" value="5.5" class="mt-1 accent-indigo-600" onchange="App.toggleCase1Option('a1-q5','5.5')"><span class="text-sm">5.5 ทางเลือกอื่นๆ</span></label>
            <textarea id="a1-q5-5.5" class="input-flat w-full hidden" rows="3" placeholder="อธิบาย (5.5) ..."></textarea>
        </div>
    </div>

    <!-- Case 2 -->
    <div id="analysis-case-2" class="card-main p-8 bg-white border border-indigo-50 rounded-[1.5rem] space-y-6 hidden">
        <div class="font-black text-indigo-900 text-lg">กรณีที่ 2 : เพิ่มปริมาณเป้าหมายผลผลิต</div>

        <div class="space-y-2">
            <div class="font-bold text-sm">1. มีแผนแสดงการขยาย/เพิ่มปริมาณกลุ่มเป้าหมายหรือปริมาณของส่วนราชการ</div>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q1" value="1.1" class="mt-1 accent-indigo-600"><span class="text-sm">1.1 เป้าหมายปริมาณกลุ่มเป้าหมายที่เพิ่มขึ้น และแผนในอนาคต</span></label>
            <textarea id="a2-q1-1.1" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q1" value="1.2" class="mt-1 accent-indigo-600"><span class="text-sm">1.2 เป้าหมายปริมาณงานที่เพิ่มขึ้น และแนวโน้มงาน</span></label>
            <textarea id="a2-q1-1.2" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>

        <div class="space-y-2">
            <div class="font-bold text-sm">2. การขยาย/เพิ่มปริมาณต้องสอดคล้องกับ</div>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q2" value="2.1" class="mt-1 accent-indigo-600"><span class="text-sm">2.1 แผนฯ13/นโยบาย/แผนปฏิบัติราชการ</span></label>
            <textarea id="a2-q2-2.1" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q2" value="2.2" class="mt-1 accent-indigo-600"><span class="text-sm">2.2 ความต้องการ/สภาพปัญหากลุ่มเป้าหมาย</span></label>
            <textarea id="a2-q2-2.2" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>

        <div class="space-y-2">
            <div class="font-bold text-sm">3. ครุภัณฑ์เดิมรองรับได้หรือไม่</div>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q3" value="3.1" class="mt-1 accent-indigo-600"><span class="text-sm">3.1 รองรับได้ ไม่ต้องจัดหาใหม่</span></label>
            <textarea id="a2-q3-3.1" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q3" value="3.2" class="mt-1 accent-indigo-600"><span class="text-sm">3.2 รองรับได้ แต่ต้องปรับปรุงครุภัณฑ์เดิม</span></label>
            <textarea id="a2-q3-3.2" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q3" value="3.3" class="mt-1 accent-indigo-600"><span class="text-sm">3.3 ไม่รองรับ ต้องจัดหาใหม่เพิ่มเติม</span></label>
            <textarea id="a2-q3-3.3" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q3" value="3.4" class="mt-1 accent-indigo-600"><span class="text-sm">3.4 อื่นๆ</span></label>
            <textarea id="a2-q3-3.4" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>

        <div class="space-y-2">
            <div class="font-bold text-sm">4. สัดส่วนจำนวนกลุ่มเป้าหมายต่อจำนวนครุภัณฑ์ (ก่อน-หลัง)</div>
            <textarea id="a2-q4" class="input-flat w-full" rows="4" placeholder="อธิบาย..."></textarea>
        </div>

        <div class="space-y-2">
            <div class="font-bold text-sm">5. สามารถใช้งานครุภัณฑ์ร่วมกับส่วนราชการอื่นได้หรือไม่</div>
            <textarea id="a2-q5" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>

        <div class="space-y-2">
            <div class="font-bold text-sm">6. สรุปทางเลือกในการใช้งานครุภัณฑ์เดิมเพื่อรองรับส่วนเพิ่ม</div>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q6" value="6.1" class="mt-1 accent-indigo-600"><span class="text-sm">6.1 ใช้ครุภัณฑ์เดิม/ลักษณะเดียวกันได้ ไม่ต้องจัดหาใหม่</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q6" value="6.2" class="mt-1 accent-indigo-600"><span class="text-sm">6.2 ต้องจัดหาใหม่เพิ่มเติม</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q6" value="6.3" class="mt-1 accent-indigo-600"><span class="text-sm">6.3 ขาดการยืนยันข้อมูล ควรตรวจสอบ/ทบทวน</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a2-q6" value="6.4" class="mt-1 accent-indigo-600"><span class="text-sm">6.4 ทางเลือกอื่นๆ</span></label>
            <textarea id="a2-q6-note" class="input-flat w-full" rows="3" placeholder="อธิบายเพิ่มเติม..."></textarea>
        </div>
    </div>

    <!-- Case 3 -->
    <div id="analysis-case-3" class="card-main p-8 bg-white border border-indigo-50 rounded-[1.5rem] space-y-6 hidden">
        <div class="font-black text-indigo-900 text-lg">กรณีที่ 3 : เพิ่มคุณภาพ/ประสิทธิภาพ/ประสิทธิผล</div>

        <div class="space-y-2">
            <div class="font-bold text-sm">1. มีข้อมูลระดับประสิทธิภาพ/คุณภาพของครุภัณฑ์เดิม หรือสภาพการดำเนินงานเดิม</div>
            <textarea id="a3-q1" class="input-flat w-full" rows="4" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">2. แผนรองรับการเพิ่มประสิทธิภาพ/คุณภาพการปฏิบัติงานตามภารกิจ</div>
            <textarea id="a3-q2" class="input-flat w-full" rows="4" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">3. ต้องสอดคล้องกับ</div>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q3" value="3.1" class="mt-1 accent-indigo-600"><span class="text-sm">3.1 แผนฯ13/นโยบาย/แผนปฏิบัติราชการ</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q3" value="3.2" class="mt-1 accent-indigo-600"><span class="text-sm">3.2 ความต้องการหรือสภาพปัญหากลุ่มเป้าหมาย</span></label>
            <textarea id="a3-q3-note" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">4. ครุภัณฑ์เดิมรองรับการเพิ่มประสิทธิภาพ/คุณภาพได้หรือไม่</div>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q4" value="4.1" class="mt-1 accent-indigo-600"><span class="text-sm">4.1 รองรับได้ ไม่ต้องจัดหาใหม่</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q4" value="4.2" class="mt-1 accent-indigo-600"><span class="text-sm">4.2 รองรับได้ แต่ต้องปรับปรุงครุภัณฑ์เดิม</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q4" value="4.3" class="mt-1 accent-indigo-600"><span class="text-sm">4.3 ไม่รองรับ ต้องจัดหาใหม่เพิ่มเติม</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q4" value="4.4" class="mt-1 accent-indigo-600"><span class="text-sm">4.4 อื่นๆ</span></label>
            <textarea id="a3-q4-note" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">5. สัดส่วนจำนวนกลุ่มเป้าหมายต่อจำนวนครุภัณฑ์ (ก่อน-หลัง)</div>
            <textarea id="a3-q5" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">6. สามารถใช้งานครุภัณฑ์ร่วมกับส่วนราชการอื่นได้หรือไม่</div>
            <textarea id="a3-q6" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">7. สรุปทางเลือกในการใช้งานครุภัณฑ์เดิมเพื่อรองรับการเพิ่มประสิทธิภาพ/คุณภาพ</div>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q7" value="7.1" class="mt-1 accent-indigo-600"><span class="text-sm">7.1 สามารถใช้งาน/ปรับปรุงครุภัณฑ์อื่นที่มีอยู่ได้</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q7" value="7.2" class="mt-1 accent-indigo-600"><span class="text-sm">7.2 ต้องจัดหาใหม่เพิ่มเติม</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q7" value="7.3" class="mt-1 accent-indigo-600"><span class="text-sm">7.3 ขาดการยืนยันข้อมูล ควรตรวจสอบ/ทบทวน</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a3-q7" value="7.4" class="mt-1 accent-indigo-600"><span class="text-sm">7.4 ทางเลือกอื่นๆ</span></label>
            <textarea id="a3-q7-note" class="input-flat w-full" rows="3" placeholder="อธิบายเพิ่มเติม..."></textarea>
        </div>
    </div>

    <!-- Case 4 -->
    <div id="analysis-case-4" class="card-main p-8 bg-white border border-indigo-50 rounded-[1.5rem] space-y-6 hidden">
        <div class="font-black text-indigo-900 text-lg">กรณีที่ 4 : เพิ่มผลผลิตใหม่</div>

        <div class="space-y-2">
            <div class="font-bold text-sm">1. ใช้ครุภัณฑ์เพื่อสนับสนุนการเพิ่มผลผลิตใหม่ให้สอดคล้องกับภารกิจของส่วนราชการ</div>
            <textarea id="a4-q1" class="input-flat w-full" rows="4" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">2. มีแผนรองรับการเพิ่มปริมาณกลุ่มเป้าหมาย/ปริมาณงาน (ใหม่)</div>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q2" value="2.1" class="mt-1 accent-indigo-600"><span class="text-sm">2.1 เป้าหมายกลุ่มเป้าหมาย (ใหม่) และแผนรองรับในอนาคต</span></label>
            <textarea id="a4-q2-2.1" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q2" value="2.2" class="mt-1 accent-indigo-600"><span class="text-sm">2.2 เป้าหมายปริมาณงาน (ใหม่) และแนวโน้มงาน (ใหม่)</span></label>
            <textarea id="a4-q2-2.2" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">3. ต้องสอดคล้องกับ</div>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q3" value="3.1" class="mt-1 accent-indigo-600"><span class="text-sm">3.1 แผนฯ13/นโยบาย/แผนปฏิบัติราชการ</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q3" value="3.2" class="mt-1 accent-indigo-600"><span class="text-sm">3.2 ความต้องการหรือสภาพปัญหากลุ่มเป้าหมาย</span></label>
            <textarea id="a4-q3-note" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">4. ครุภัณฑ์เดิมรองรับปริมาณกลุ่มเป้าหมาย/ปริมาณงาน (ใหม่) ได้หรือไม่</div>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q4" value="4.1" class="mt-1 accent-indigo-600"><span class="text-sm">4.1 รองรับได้ ไม่ต้องจัดหาใหม่</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q4" value="4.2" class="mt-1 accent-indigo-600"><span class="text-sm">4.2 รองรับได้ แต่ต้องปรับปรุงใช้ครุภัณฑ์ที่มีอยู่</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q4" value="4.3" class="mt-1 accent-indigo-600"><span class="text-sm">4.3 ไม่รองรับ ต้องจัดหาใหม่เพิ่มเติม</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q4" value="4.4" class="mt-1 accent-indigo-600"><span class="text-sm">4.4 อื่นๆ</span></label>
            <textarea id="a4-q4-note" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">5. สัดส่วนจำนวนกลุ่มเป้าหมายต่อจำนวนครุภัณฑ์ (ก่อน-หลัง)</div>
            <textarea id="a4-q5" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">6. สามารถใช้งานครุภัณฑ์ร่วมกับส่วนราชการอื่นได้หรือไม่</div>
            <textarea id="a4-q6" class="input-flat w-full" rows="3" placeholder="อธิบาย..."></textarea>
        </div>
        <div class="space-y-2">
            <div class="font-bold text-sm">7. สรุปทางเลือกในการใช้งานครุภัณฑ์เดิมเพื่อรองรับการเพิ่มผลผลิตใหม่</div>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q7" value="7.1" class="mt-1 accent-indigo-600"><span class="text-sm">7.1 สามารถใช้งาน/ปรับปรุงครุภัณฑ์อื่นที่มีอยู่ได้</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q7" value="7.2" class="mt-1 accent-indigo-600"><span class="text-sm">7.2 ต้องจัดหาใหม่เพิ่มเติม</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q7" value="7.3" class="mt-1 accent-indigo-600"><span class="text-sm">7.3 ขาดการยืนยันข้อมูล ควรตรวจสอบ/ทบทวน</span></label>
            <label class="flex items-start gap-3"><input type="radio" name="a4-q7" value="7.4" class="mt-1 accent-indigo-600"><span class="text-sm">7.4 ทางเลือกอื่นๆ</span></label>
            <textarea id="a4-q7-note" class="input-flat w-full" rows="3" placeholder="อธิบายเพิ่มเติม..."></textarea>
        </div>
    </div>
</div>

<!-- ลงนามเฉพาะตอนพิมพ์ -->
                <div class="hidden print:block mt-20 space-y-16">
                    <div class="flex justify-between px-20 text-center text-sm font-bold">
                        <div>
                            <p>ลงชื่อ ..................................................ผู้เสนอ</p>
                            <p>(..................................................)</p>
                            <p>วันที่..................................................</p>
                        </div>
                        <div>
                            <p>ลงชื่อ ..................................................หัวหน้าสาขา/หัวหน้างาน</p>
                            <p>(..................................................)</p>
                            <p>วันที่..................................................</p>
                        </div>
                    </div>
                    <div class="text-center px-20 text-sm font-bold">
                        <p>ลงชื่อ ..................................................คณบดี</p>
                        <p>(..................................................)</p>
                        <p>วันที่..................................................</p>
                    </div>
                </div>

            </div>
        </div>
<!-- ===== ปุ่มล่างสุด บันทึก / ล้างค่า ===== -->
<div class="no-print mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
    <button onclick="App.saveForm4()"
        class="flex-1 sm:flex-none sm:w-56 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 text-base transition-all">
        <i data-lucide="save" class="w-5 h-5"></i> บันทึก
    </button>
    <button onclick="App.resetForm4()"
        class="flex-1 sm:flex-none sm:w-44 bg-white text-gray-500 py-4 rounded-2xl font-bold shadow-sm border border-gray-200 flex items-center justify-center gap-3 text-base hover:bg-gray-50 transition-all">
        <i data-lucide="refresh-ccw" class="w-5 h-5"></i> ล้างค่า
    </button>
    <button onclick="window.print()"
        class="flex-1 sm:flex-none sm:w-44 bg-slate-700 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-3 text-base transition-all">
        <i data-lucide="printer" class="w-5 h-5"></i> Print / PDF
    </button>
</div>

<!-- ===== ตารางรายการที่บันทึก ===== -->
<div class="no-print mt-12 rounded-[2rem] bg-white border border-indigo-100 shadow-sm overflow-hidden">
    <div class="flex items-center justify-between gap-4 px-8 py-5 border-b border-indigo-50 bg-indigo-50/40">
        <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                <i data-lucide="database" class="w-5 h-5 text-white"></i>
            </div>
            <div>
                <div class="font-black text-indigo-950 text-base">รายการที่บันทึกแล้ว</div>
                <div class="text-[11px] font-bold text-gray-400">คลิก ✏️ เพื่อแก้ไข &nbsp;|&nbsp; 🖨️ เพื่อ Print/PDF &nbsp;|&nbsp; 🗑️ เพื่อลบ</div>
            </div>
        </div>
        <button onclick="App.loadForm4Records()"
            class="p-2.5 bg-white rounded-xl shadow-sm text-gray-400 hover:text-indigo-600 border border-indigo-50 transition-all" title="รีเฟรช">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
        </button>
    </div>
    <div class="overflow-x-auto">
        <table class="w-full text-left text-sm min-w-[700px]">
            <thead class="table-header">
                <tr>
                    <th class="px-4 py-4 text-center w-12">#</th>
                    <th class="px-4 py-4">ชื่อรายการ</th>
                    <th class="px-4 py-4">หน่วยงาน</th>
                    <th class="px-4 py-4">แผนพัฒนา</th>
                    <th class="px-4 py-4">ผู้บันทึก</th>
                    <th class="px-4 py-4">วันที่บันทึก</th>
                    <th class="px-4 py-4 text-center w-36">จัดการ</th>
                </tr>
            </thead>
            <tbody id="f4-records-tbody" class="divide-y divide-gray-50">
                <tr><td colspan="7" class="px-6 py-8 text-center text-gray-400 text-xs font-bold">กำลังโหลด...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<!-- Admin Edit Modal Root (เฉพาะหน้า ตั้งต้นข้อมูล) -->
<div id="admin-edit-modal" class="hidden"></div>`;
    },

    adminPage(subTab = 'tab1') {
        return `<div class="animate-in fade-in duration-500">
            <div class="flex gap-4 mb-8 no-print">
                <button onclick="App.switchSubTab('admin', 'tab1')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab1' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-purple-50'}">1. ตั้งต้นข้อมูล</button>
                <button onclick="App.switchSubTab('admin', 'tab2')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab2' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-purple-50'}">2. จัดการผู้ใช้งานระบบ</button>
            </div>
            ${subTab === 'tab1' ? this.adminSetupDataTemplate() : this.adminUserTemplate()}
        </div>
<!-- Admin Edit Modal Root (เฉพาะหน้า ตั้งต้นข้อมูล) -->
<div id="admin-edit-modal" class="hidden"></div>`;
    },

    adminSetupDataTemplate() {
        return `<div class="space-y-8">
            <!-- หมวดข้อมูลทั่วไป -->
            <div class="card-main p-8 relative overflow-hidden shadow-xl bg-white">
                <div class="rainbow-line absolute top-0 left-0 w-full"></div>
                <h5 class="font-black text-[#4c1d95] flex items-center gap-2 mb-6"><i data-lucide="layers" size="20"></i> หมวดข้อมูลทั่วไป</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div class="space-y-4">
                        <div class="flex flex-col gap-1.5"><label class="text-xs font-bold text-gray-500">ประเภทเงินงบประมาณ</label><div class="flex gap-2"><input id="m-budget-type" placeholder="ใส่ข้อมูลประเภทเงินใหม่" class="input-flat flex-1"><button onclick="App.saveMaster('budget_types', 'm-budget-type')" class="p-3 bg-purple-600 text-white rounded-xl shadow-md"><i data-lucide="save" size="18"></i></button></div></div>
                        <div class="flex flex-col gap-1.5"><label class="text-xs font-bold text-gray-500">รายการ</label><p class="text-[10px] text-gray-400 italic">แบบรายการเดียว หรือ ชุดห้องปฏิบัติการ ฯลฯ</p><div class="flex gap-2"><input id="m-item-name" placeholder="ชื่อรายการ..." class="input-flat flex-1"><button onclick="App.saveMaster('items', 'm-item-name')" class="p-3 bg-purple-600 text-white rounded-xl shadow-md"><i data-lucide="save" size="18"></i></button></div></div>
                    </div>
                    <div class="space-y-4">
                        <div class="flex flex-col gap-1.5"><label class="text-xs font-bold text-gray-400">ปีงบประมาณ</label><div class="flex gap-2"><input id="m-budget-year" placeholder="ใส่ข้อมูลปีงบประมาณ" class="input-flat flex-1"><button onclick="App.saveMaster('years', 'm-budget-year')" class="p-3 bg-purple-600 text-white rounded-xl shadow-md"><i data-lucide="save" size="18"></i></button></div></div>
                        <div class="flex flex-col gap-1.5"><label class="text-xs font-bold text-gray-400">ประเภท</label><div class="flex gap-2"><input id="m-category" placeholder="รายละเอียดประเภทครุภัณฑ์" class="input-flat flex-1"><button onclick="App.saveMaster('categories', 'm-category')" class="p-3 bg-purple-600 text-white rounded-xl shadow-md"><i data-lucide="save" size="18"></i></button></div></div>
                    </div>
                    <!-- หน่วยนับ 4 ช่อง ตามสั่ง -->
                    <div class="md:col-span-2 border-t pt-4 flex flex-col gap-1.5"><label class="text-xs font-bold text-gray-400">หน่วยนับ</label><div class="flex gap-3"><input id="m-unit-1" placeholder="หน่วย 1" class="input-flat flex-1"><input id="m-unit-2" placeholder="หน่วย 2" class="input-flat flex-1"><input id="m-unit-3" placeholder="หน่วย 3" class="input-flat flex-1"><input id="m-unit-4" placeholder="หน่วย 4" class="input-flat flex-1"><button onclick="App.saveUnits()" class="bg-green-500 text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"><i data-lucide="save" size="18"></i> บันทึกหน่วยนับ</button></div></div>

                    <!-- เพิ่มเติม: หมวดหมู่ย่อย (ประเภทสิ่งของ) + มาตรฐานครุภัณฑ์ (ไม่ผูกปี) -->
                    <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div class="flex flex-col gap-1.5"><label class="text-xs font-bold text-gray-400">หมวดหมู่ย่อย (ประเภทสิ่งของ)</label><div class="flex gap-2"><input id="m-sub-category" placeholder="ใส่ข้อมูลหมวดหมู่ย่อย" class="input-flat flex-1"><button onclick="App.saveMaster('sub_categories', 'm-sub-category')" class="p-3 bg-purple-600 text-white rounded-xl shadow-md"><i data-lucide="save" size="18"></i></button></div></div>
                        <div class="flex flex-col gap-1.5"><label class="text-xs font-bold text-gray-400">มาตรฐานครุภัณฑ์</label><div class="flex gap-2"><input id="m-asset-standard" placeholder="ใส่ข้อมูลมาตรฐานครุภัณฑ์" class="input-flat flex-1"><button onclick="App.saveMaster('asset_standards', 'm-asset-standard')" class="p-3 bg-purple-600 text-white rounded-xl shadow-md"><i data-lucide="save" size="18"></i></button></div></div>
                    </div>
                </div>
            </div>

            <!-- หมวดโครงสร้างองค์กร (ย้ายพื้นหลังเป็นสีขาว) -->
            <div class="card-main p-8 shadow-xl bg-white"><h5 class="font-black text-blue-800 flex items-center gap-2 mb-6"><i data-lucide="building-2" size="20"></i> หมวดโครงสร้างองค์กร</h5><div class="grid grid-cols-1 md:grid-cols-2 gap-8"><div class="bg-white p-6 rounded-[2rem] border border-blue-50 shadow-sm"><p class="text-[11px] font-black text-blue-600 mb-4 uppercase tracking-wider">หน่วยงาน</p><div class="flex gap-2"><input id="m-dept-name" placeholder="ใส่ข้อมูลหน่วยงาน" class="input-flat flex-1 border-blue-100"><button onclick="App.saveMaster('depts', 'm-dept-name')" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-md"><i data-lucide="save" size="18"></i> บันทึก</button></div></div><div class="bg-white p-6 rounded-[2rem] border border-blue-50 border-dashed shadow-sm"><p class="text-[11px] font-black text-blue-600 mb-4 uppercase tracking-wider">สาขา / งาน (เชื่อมโยงจากหน่วยงาน)</p><div class="space-y-3"><select id="m-dept-select" class="input-flat w-full border-blue-100 font-bold bg-gray-50"></select><div class="flex gap-2"><input id="m-branch-name" placeholder="ระบุชื่อสาขา/งาน..." class="input-flat flex-1 border-blue-100 italic"><button onclick="App.saveBranch()" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"><i data-lucide="link" size="18"></i> เชื่อมโยง</button></div></div></div></div></div>

            <!-- ===== หมวดข้อมูลยุทธศาสตร์และตัวชี้วัด (ออกแบบใหม่) ===== -->
            <div class="card-main p-8 relative shadow-xl bg-white">
                <div class="rainbow-line absolute top-0 left-0 w-full h-[3px]"></div>
                <h5 class="font-black text-purple-800 flex items-center gap-2 mb-1">
                    <i data-lucide="target" size="20"></i> หมวดข้อมูลยุทธศาสตร์และตัวชี้วัด
                </h5>
                <p class="text-[11px] text-gray-400 font-bold mb-6">ขั้นที่ 1: บันทึกข้อมูลแต่ละหัวข้อก่อน → ขั้นที่ 2: เชื่อมโยงเป็น 7 Step</p>

                <!-- ===== ส่วน A: บันทึกข้อมูลรายหัวข้อ (ยังไม่เชื่อมโยง) ===== -->
                <div class="bg-purple-50/60 border border-purple-100 rounded-2xl p-6 mb-6">
                    <div class="flex items-center gap-2 mb-5">
                        <span class="w-7 h-7 rounded-lg bg-purple-600 text-white text-xs font-black flex items-center justify-center">A</span>
                        <span class="font-black text-purple-800 text-sm">บันทึกข้อมูลแต่ละหัวข้อ (ยังไม่เชื่อมโยง)</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[11px] font-black text-purple-700">📋 ฉบับแผนพัฒนามหาวิทยาลัย</label>
                            <div class="flex gap-2"><input id="si-plan" placeholder="เช่น ฉบับที่ 13" class="input-flat flex-1 text-sm"><button onclick="App.saveStratItem('strat_plans','si-plan')" class="p-3 shrink-0 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><i data-lucide="save" size="16"></i></button></div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[11px] font-black text-purple-700">🎯 ประเด็นยุทธศาสตร์</label>
                            <div class="flex gap-2"><input id="si-issue" placeholder="เช่น ยุทธศาสตร์ที่ 1 มุ่งความเป็นเลิศ..." class="input-flat flex-1 text-sm"><button onclick="App.saveStratItem('strat_issues','si-issue')" class="p-3 shrink-0 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><i data-lucide="save" size="16"></i></button></div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[11px] font-black text-purple-700">📌 วัตถุประสงค์เชิงยุทธศาสตร์</label>
                            <div class="flex gap-2"><input id="si-strategy" placeholder="เช่น วัตถุประสงค์ที่ 1.1..." class="input-flat flex-1 text-sm"><button onclick="App.saveStratItem('strat_strategies','si-strategy')" class="p-3 shrink-0 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><i data-lucide="save" size="16"></i></button></div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[11px] font-black text-purple-700">⚡ กลยุทธ์</label>
                            <div class="flex gap-2"><input id="si-dim" placeholder="เช่น กลยุทธ์ที่ 1 Integrated Innovator..." class="input-flat flex-1 text-sm"><button onclick="App.saveStratItem('strat_dimensions','si-dim')" class="p-3 shrink-0 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><i data-lucide="save" size="16"></i></button></div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[11px] font-black text-purple-700">🔹 กลยุทธ์ย่อย</label>
                            <div class="flex gap-2"><input id="si-sub" placeholder="เช่น กลยุทธ์ย่อยที่ 1.1..." class="input-flat flex-1 text-sm"><button onclick="App.saveStratItem('strat_sub_strategies','si-sub')" class="p-3 shrink-0 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><i data-lucide="save" size="16"></i></button></div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[11px] font-black text-purple-700">🔷 มิติ</label>
                            <div class="flex gap-2"><input id="si-kpidim" placeholder="เช่น มิติที่ 1 ด้านนวัตกรรม..." class="input-flat flex-1 text-sm"><button onclick="App.saveStratItem('strat_kpis','si-kpidim','dimension')" class="p-3 shrink-0 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><i data-lucide="save" size="16"></i></button></div>
                        </div>
                        <div class="flex flex-col gap-1.5 md:col-span-2">
                            <label class="text-[11px] font-black text-purple-700">📊 ตัวชี้วัด</label>
                            <div class="flex gap-2"><input id="si-kpi" placeholder="เช่น จำนวนนักศึกษาที่ได้รับการพัฒนา..." class="input-flat flex-1 text-sm"><button onclick="App.saveStratItem('strat_kpis','si-kpi','kpi')" class="p-3 shrink-0 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><i data-lucide="save" size="16"></i></button></div>
                        </div>
                    </div>
                </div>

                <!-- ===== ส่วน B: เชื่อมโยง 7 Step ===== -->
                <div class="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-6">
                    <div class="flex items-center gap-2 mb-5">
                        <span class="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center">B</span>
                        <span class="font-black text-indigo-800 text-sm">เชื่อมโยงข้อมูลตามลำดับ (7 Step)</span>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-50">
                            <span class="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                            <span class="text-[11px] font-black text-gray-500 w-52 shrink-0">ฉบับแผนพัฒนามหาวิทยาลัย</span>
                            <select id="lnk-plan" onchange="App.onLinkChange('plan')" class="input-flat flex-1 min-w-0 text-sm font-bold bg-gray-50/50"><option value="">— เลือกฉบับที่ —</option></select>
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-50">
                            <span class="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                            <span class="text-[11px] font-black text-gray-500 w-52 shrink-0">ประเด็นยุทธศาสตร์</span>
                            <select id="lnk-issue" onchange="App.onLinkChange('issue')" disabled class="input-flat flex-1 min-w-0 text-sm font-bold bg-gray-50/50 opacity-60"><option value="">— เลือกยุทธศาสตร์ —</option></select>
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-50">
                            <span class="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">3</span>
                            <span class="text-[11px] font-black text-gray-500 w-52 shrink-0">วัตถุประสงค์เชิงยุทธศาสตร์</span>
                            <select id="lnk-strategy" onchange="App.onLinkChange('strategy')" disabled class="input-flat flex-1 min-w-0 text-sm font-bold bg-gray-50/50 opacity-60"><option value="">— เลือกวัตถุประสงค์ฯ —</option></select>
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-50">
                            <span class="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">4</span>
                            <span class="text-[11px] font-black text-gray-500 w-52 shrink-0">กลยุทธ์</span>
                            <select id="lnk-dim" onchange="App.onLinkChange('dim')" disabled class="input-flat flex-1 min-w-0 text-sm font-bold bg-gray-50/50 opacity-60"><option value="">— เลือกกลยุทธ์ —</option></select>
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-50">
                            <span class="w-6 h-6 rounded-full bg-indigo-400 text-white text-[10px] font-black flex items-center justify-center shrink-0">5</span>
                            <span class="text-[11px] font-black text-gray-500 w-52 shrink-0">กลยุทธ์ย่อย</span>
                            <select id="lnk-sub" onchange="App.onLinkChange('sub')" disabled class="input-flat flex-1 min-w-0 text-sm font-bold bg-gray-50/50 opacity-60"><option value="">— เลือกกลยุทธ์ย่อย —</option></select>
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-50">
                            <span class="w-6 h-6 rounded-full bg-indigo-400 text-white text-[10px] font-black flex items-center justify-center shrink-0">6</span>
                            <span class="text-[11px] font-black text-gray-500 w-52 shrink-0">มิติ</span>
                            <select id="lnk-kpidim" onchange="App.onLinkChange('kpidim')" disabled class="input-flat flex-1 min-w-0 text-sm font-bold bg-gray-50/50 opacity-60"><option value="">— เลือกมิติ —</option></select>
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-50">
                            <span class="w-6 h-6 rounded-full bg-green-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">7</span>
                            <span class="text-[11px] font-black text-gray-500 w-52 shrink-0">ตัวชี้วัด</span>
                            <select id="lnk-kpi" disabled class="input-flat flex-1 min-w-0 text-sm font-bold bg-gray-50/50 opacity-60"><option value="">— เลือกตัวชี้วัด —</option></select>
                        </div>
                        <div class="flex justify-end pt-3">
                            <button onclick="App.saveStratLink()" class="bg-green-600 hover:bg-green-700 text-white font-black px-8 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm">
                                <i data-lucide="check-circle" size="18"></i> บันทึกความเชื่อมโยง
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </div>

<!-- ===== ตารางที่ 1: ข้อมูลดิบ 7 หน้า ===== -->
<div class="mt-8 card-main p-8 bg-white shadow-xl border border-purple-50">
    <div class="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shrink-0"><i data-lucide="database" class="w-5 h-5 text-white"></i></div>
            <div>
                <div class="font-black text-purple-950 text-base">ตารางที่ 1 — ข้อมูลที่บันทึกทั้งหมด</div>
                <div id="strat-t1-badge" class="text-[11px] font-bold text-purple-600">หน้า 1 / 7 — ฉบับแผนพัฒนามหาวิทยาลัย</div>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="App.stratT1Prev()" title="ก่อนหน้า" class="w-9 h-9 rounded-xl border border-purple-100 bg-white hover:bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
            <button onclick="App.stratT1Next()" title="ถัดไป"  class="w-9 h-9 rounded-xl border border-purple-100 bg-white hover:bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
        </div>
    </div>
    <div id="strat-t1-p1">${this.adminTableBlock('ฉบับแผนพัฒนามหาวิทยาลัย','strat_plans',['ลำดับ','ชื่อฉบับแผน','วันที่บันทึก'])}</div>
    <div id="strat-t1-p2" class="hidden">${this.adminTableBlock('ประเด็นยุทธศาสตร์','strat_issues',['ลำดับ','ชื่อประเด็นยุทธศาสตร์','วันที่บันทึก'])}</div>
    <div id="strat-t1-p3" class="hidden">${this.adminTableBlock('วัตถุประสงค์เชิงยุทธศาสตร์','strat_strategies',['ลำดับ','ชื่อวัตถุประสงค์เชิงยุทธศาสตร์','วันที่บันทึก'])}</div>
    <div id="strat-t1-p4" class="hidden">${this.adminTableBlock('กลยุทธ์','strat_dimensions',['ลำดับ','ชื่อกลยุทธ์','วันที่บันทึก'])}</div>
    <div id="strat-t1-p5" class="hidden">${this.adminTableBlock('กลยุทธ์ย่อย','strat_sub_strategies',['ลำดับ','ชื่อกลยุทธ์ย่อย','วันที่บันทึก'])}</div>
    <div id="strat-t1-p6" class="hidden">${this.adminTableBlock('มิติ','strat_kpis_dim',['ลำดับ','ชื่อมิติ','ประเภท','วันที่บันทึก'])}</div>
    <div id="strat-t1-p7" class="hidden">${this.adminTableBlock('ตัวชี้วัด','strat_kpis_kpi',['ลำดับ','ชื่อตัวชี้วัด','ประเภท','วันที่บันทึก'])}</div>
</div>

<!-- ===== ตารางที่ 2: ความเชื่อมโยง Step ===== -->
<div class="mt-6 card-main p-8 bg-white shadow-xl border border-indigo-50">
    <div class="flex items-center gap-3 mb-5">
        <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0"><i data-lucide="git-branch" class="w-5 h-5 text-white"></i></div>
        <div>
            <div class="font-black text-indigo-950 text-base">ตารางที่ 2 — ความเชื่อมโยง (Step-by-Step)</div>
            <div class="text-[11px] font-bold text-gray-400">ข้อมูลที่เชื่อมโยงครบ 7 ขั้น (แก้ไข / ลบได้)</div>
        </div>
    </div>
    ${this.adminTableBlock('แผนพัฒนามหาวิทยาลัยฯ และความเชื่อมโยง','strat_links',['ลำดับ','ฉบับแผน','ยุทธศาสตร์','วัตถุประสงค์ฯ','กลยุทธ์','กลยุทธ์ย่อย','มิติ','ตัวชี้วัด','วันที่บันทึก'])}
</div>

<!-- ตารางข้อมูลทั่วไป -->
<div class="mt-6 rounded-[2.5rem] bg-slate-900/8 border border-slate-200 p-6 md:p-8 space-y-6">
    <div class="space-y-8">
    ${this.adminTableBlock('ประเภทเงินงบประมาณ','budget_types',['ลำดับ','ชื่อประเภทเงินงบประมาณ','วันที่บันทึก'])}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        ${this.adminMiniTableBlock('ปีงบประมาณ','years',['ลำดับ','ปี พ.ศ.','สถานะ','หมายเหตุ','วันที่บันทึก'])}
        ${this.adminMiniTableBlock('หน่วยนับ','units',['ลำดับ','ชื่อหน่วยนับ','วันที่บันทึก'])}
    </div>
    ${this.adminTableBlock('หมวดหมู่ย่อย (ประเภทสิ่งของ)','sub_categories',['ลำดับ','ชื่อหมวดหมู่ย่อย','วันที่บันทึก'])}
    ${this.adminTableBlock('มาตรฐานครุภัณฑ์','asset_standards',['ลำดับ','ชื่อมาตรฐาน','วันที่บันทึก'])}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        ${this.adminMiniTableBlock('รายการ','items',['ลำดับ','ชื่อรายการ','วันที่บันทึก'])}
        ${this.adminMiniTableBlock('ประเภทครุภัณฑ์','categories',['ลำดับ','ชื่อประเภท','วันที่บันทึก'])}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        ${this.adminMiniTableBlock('หน่วยงาน','depts',['ลำดับ','ชื่อหน่วยงาน','วันที่บันทึก'])}
        ${this.adminMiniTableBlock('สาขา / งาน','branches',['ลำดับ','หน่วยงาน','สาขา/งาน','วันที่บันทึก'])}
    </div>
    </div>
</div>
<!-- Admin Edit Modal Root -->
<div id="admin-edit-modal" class="hidden"></div>`;
    },



// --- Admin Setup: Table Blocks (แสดงข้อมูลจริง + ค้นหา + แบ่งหน้า) ---
adminTableBlock(title, key, headers) {
    return `<div class="card-main p-8 bg-white shadow-2xl border border-purple-50">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h5 class="font-black text-indigo-950 flex items-center gap-2">
                <i data-lucide="table-2" class="w-5 h-5 text-purple-600"></i> ${title}
            </h5>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-purple-50">
                    <i data-lucide="search" class="text-purple-400 w-5 h-5 ml-2"></i>
                    <input id="adm-search-${key}" oninput="App.adminFilter('${key}')" placeholder="ค้นหา..." class="input-flat py-2 text-xs border-none bg-transparent focus:ring-0 w-56">
                </div>
                <div class="flex gap-2 items-center">
                    <button onclick="App.adminPrevPage('${key}')" class="p-2.5 bg-white rounded-xl shadow-sm text-gray-400 hover:text-purple-600 transition-all"><i data-lucide="chevron-left" size="20"></i></button>
                    <div class="bg-purple-600 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md" id="adm-page-${key}">หน้า 1</div>
                    <button onclick="App.adminNextPage('${key}')" class="p-2.5 bg-white rounded-xl shadow-sm text-gray-400 hover:text-purple-600 transition-all"><i data-lucide="chevron-right" size="20"></i></button>
                </div>
            </div>
        </div>

        <div class="overflow-hidden border border-purple-50 rounded-[2rem] bg-white shadow-sm">
            <table class="w-full text-left text-sm">
                <thead class="table-header">
                    <tr class="bg-purple-50/40">
                        ${headers.map(h => `<th class="px-6 py-4">${h}</th>`).join('')}
                        <th class="px-6 py-4 text-center w-40">จัดการ</th>
                    </tr>
                </thead>
                <tbody id="adm-tbody-${key}" class="divide-y divide-gray-50"></tbody>
            </table>
        </div>
    </div>`;
},

adminMiniTableBlock(title, key, headers) {
    return `<div class="bg-white p-6 rounded-[2rem] border border-purple-50 shadow-sm">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div class="font-black text-sm text-indigo-950">${title}</div>
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-purple-50">
                    <i data-lucide="search" class="text-purple-400 w-4 h-4 ml-1"></i>
                    <input id="adm-search-${key}" oninput="App.adminFilter('${key}')" placeholder="ค้นหา..." class="input-flat py-1.5 text-xs border-none bg-transparent focus:ring-0 w-44">
                </div>
                <button onclick="App.adminPrevPage('${key}')" class="p-2 bg-white rounded-xl shadow-sm text-gray-400 hover:text-purple-600 transition-all"><i data-lucide="chevron-left" size="18"></i></button>
                <div class="bg-purple-600 text-white px-3 py-2 rounded-xl text-[11px] font-bold shadow-md" id="adm-page-${key}">หน้า 1</div>
                <button onclick="App.adminNextPage('${key}')" class="p-2 bg-white rounded-xl shadow-sm text-gray-400 hover:text-purple-600 transition-all"><i data-lucide="chevron-right" size="18"></i></button>
            </div>
        </div>

        <div class="overflow-hidden border border-purple-50 rounded-[1.5rem] bg-white">
            <table class="w-full text-left text-sm">
                <thead class="table-header">
                    <tr class="bg-purple-50/40">
                        ${headers.map(h => `<th class="px-4 py-3 text-[11px]">${h}</th>`).join('')}
                        <th class="px-4 py-3 text-center w-28 text-[11px]">จัดการ</th>
                    </tr>
                </thead>
                <tbody id="adm-tbody-${key}" class="divide-y divide-gray-50"></tbody>
            </table>
        </div>
    </div>`;
},

    adminUserTemplate() {
        return `<div class="card-main relative overflow-hidden p-10"><div class="rainbow-line absolute top-0 left-0 w-full h-1"></div><h3 class="text-[#4c1d95] font-black text-2xl flex items-center gap-3 mb-10"><i data-lucide="users" size="28"></i> จัดการผู้ใช้งานระบบ</h3><div class="bg-[#f5f3ff] p-8 rounded-[2rem] border border-purple-100 shadow-sm mb-12"><div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 items-end"><input type="hidden" id="u-edit-id"><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">Username</label><input id="u-user" placeholder="ระบุชื่อผู้ใช้" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">Password</label><input id="u-pass" placeholder="ระบุรหัสผ่าน" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">ชื่อ-นามสกุล</label><input id="u-fullname" placeholder="ระบุชื่อ-สกุล" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">สิทธิ์การใช้งาน</label><select id="u-role" class="input-flat w-full bg-white font-bold"><option value="admin">ผู้ดูแลระบบ</option><option value="manager">ผู้บริหาร</option><option value="staff_central">เจ้าหน้าที่ส่วนกลาง</option><option value="staff_dept">เจ้าหน้าที่หน่วยงาน</option></select></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">ตำแหน่ง</label><input id="u-pos" placeholder="ระบุตำแหน่ง" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">หน่วยงาน</label><select id="u-dept-select" class="input-flat w-full bg-white font-bold"></select></div><div class="lg:col-span-2 flex gap-2 justify-end"><button id="btn-save-user" onclick="App.saveUser()" class="bg-[#10b981] hover:bg-green-600 text-white h-[42px] px-6 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"><i data-lucide="check-circle" size="18"></i> บันทึก</button><button onclick="App.resetUserForm()" class="bg-gray-100 text-gray-400 h-[42px] w-[42px] rounded-xl flex items-center justify-center hover:bg-gray-200"><i data-lucide="refresh-ccw" size="18"></i></button></div></div></div><div class="overflow-hidden border border-purple-50 rounded-[2rem] bg-white shadow-xl"><table class="w-full text-left text-sm"><thead class="table-header"><tr class="bg-indigo-50/50"><th class="px-6 py-5">Username</th><th class="px-6 py-5">Password</th><th class="px-6 py-5">ชื่อ - นามสกุล</th><th class="px-6 py-5 text-center">สิทธิ์</th><th class="px-6 py-5">ตำแหน่ง</th><th class="px-6 py-5">หน่วยงาน</th><th class="px-6 py-5">วันที่บันทึก</th><th class="px-6 py-5 text-center">จัดการ</th></tr></thead><tbody id="user-list-body" class="divide-y divide-gray-50"></tbody></table></div><div id="user-edit-modal" class="hidden"></div></div>`;
    }
    
};
/* ===== RENDER TABLE ===== */

function renderForm4Table(data) {
    const el = document.getElementById("form4-table");

    if (!el) return;

    el.innerHTML = `
    <div class="card-main p-4">
        <table class="w-full text-sm">
            <thead class="table-header">
                <tr>
                    <th>รายการ</th>
                    <th>วงเงิน</th>
                    <th>หน่วยงาน</th>
                    <th>ปี</th>
                    <th>จัดการ</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(d => `
                    <tr>
                        <td>${d.itemName || '-'}</td>
                        <td>${(d.totalAmount || 0).toLocaleString()}</td>
                        <td>${d.deptName || '-'}</td>
                        <td>${d.fiscalYear || '-'}</td>
                        <td class="space-x-2">
                            <button onclick='previewForm4(${JSON.stringify(d)})'>👁</button>
                            <button onclick='loadForm4ToForm("${d.id}")'>✏️</button>
                            <button onclick='deleteForm4("${d.id}")'>🗑</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    </div>
    `;
}
