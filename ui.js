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
        </div>`;
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
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6"><div class="card-main p-8"><h5 class="font-bold text-sm text-gray-500 mb-6 flex items-center gap-2"><i data-lucide="bar-chart-big" size="16"></i> งบประมาณแยกตามหน่วยงาน</h5><canvas id="deptBudgetChart" height="200"></canvas></div><div class="card-main p-8"><h5 class="font-bold text-sm text-gray-500 mb-6 flex items-center gap-2"><i data-lucide="pie-chart" size="16"></i> สัดส่วนประเภทครุภัณฑ์</h5><canvas id="catPieChart" height="200"></canvas></div></div>
            <div class="card-main overflow-hidden border-white shadow-sm"><table class="w-full text-left"><thead class="table-header"><tr><th class="px-6 py-4">หน่วยงาน</th><th class="px-6 py-4">ประเภทเงิน</th><th class="px-6 py-4">ปีงบประมาณ</th><th class="px-6 py-4">สาขา/งาน</th><th class="px-6 py-4">รายการ</th><th class="px-6 py-4 text-right">จำนวนเงิน</th></tr></thead><tbody id="dash-table-body" class="divide-y divide-gray-50 text-sm"></tbody></table></div>
        </div>`;
    },

    dashboardCompareTemplate() {
        return `<div class="space-y-10"><section class="space-y-6"><div class="flex items-center gap-3 border-b-2 border-indigo-100 pb-2"><div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">1</div><h4 class="font-black text-indigo-900 text-lg">ข้อมูล 5 ปีงบประมาณย้อนหลัง</h4></div><div class="card-main p-6 flex flex-wrap gap-4 items-end bg-indigo-50/30"><div class="w-64 space-y-1.5"><label class="text-[10px] font-bold text-gray-400">หน่วยงาน</label><select id="comp-dept-1" class="input-flat w-full bg-white text-xs"></select></div><div class="w-64 space-y-1.5"><label class="text-[10px] font-bold text-gray-400">ประเภทเงินงบประมาณ</label><select id="comp-budget-1" class="input-flat w-full bg-white text-xs"></select></div><div class="flex-1 space-y-1.5"><label class="text-[10px] font-bold text-gray-400">ช่วงปีงบประมาณ</label><div class="flex items-center gap-2"><select id="year-start" class="input-flat flex-1 bg-white text-xs"></select><span class="text-gray-400 text-xs font-bold">ถึง</span><select id="year-end" class="input-flat flex-1 bg-white text-xs"></select></div></div><button onclick="App.loadCompareChart()" class="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2"><i data-lucide="bar-chart" size="14"></i> แสดงข้อมูล</button></div><div class="card-main p-10 bg-white"><canvas id="timeSeriesLineChart" height="120"></canvas></div></section><section class="space-y-6"><div class="flex items-center gap-3 border-b-2 border-purple-100 pb-2"><div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">2</div><h4 class="font-black text-purple-900 text-lg">ข้อมูลเปรียบเทียบระหว่างปีงบประมาณ</h4></div><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="space-y-1.5"><label class="text-[10px] font-bold text-gray-400 ml-2">หน่วยงาน</label><select id="comp-dept-2" class="input-flat w-full bg-white text-sm"></select></div><div class="space-y-1.5"><label class="text-[10px] font-bold text-gray-400 ml-2">ประเภทเงินงบประมาณ</label><select id="comp-budget-2" class="input-flat w-full bg-white text-sm"></select></div><div class="space-y-1.5"><label class="text-[10px] font-bold text-gray-400 ml-2 text-purple-600">* เลือกปีที่ต้องการเทียบ</label><div class="flex items-center gap-2"><select id="comp-year-a" class="input-flat flex-1 bg-white text-sm border-purple-200"></select><span class="text-gray-300 font-bold">VS</span><select id="comp-year-b" class="input-flat flex-1 bg-white text-sm border-purple-200"></select></div></div></div><div class="flex justify-center mt-4"><button onclick="App.runComparison()" class="bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3"><i data-lucide="columns" size="20"></i> เปรียบเทียบข้อมูล</button></div></section></div>`;
    },

    managePage(subTab = 'tab1') {
        return `<div class="animate-in fade-in duration-500">
            <div class="flex gap-4 mb-8 no-print">
                <button onclick="App.switchSubTab('manage', 'tab1')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab1' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500'}">(ง.4)</button>
                <button onclick="App.switchSubTab('manage', 'tab2')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab2' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500'}">(ง.5)</button>
                <button onclick="App.switchSubTab('manage', 'tab3')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab3' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500'}">(ง.6)</button>
            </div>
            ${subTab === 'tab1' ? this.manageForm4Template() : `<div class="card-main p-20 text-center text-gray-300 italic">อยู่ระหว่างรอดำเนินการ</div>`}
        </div>`;
    },

    manageForm4Template() {
        return `<div class="card-main p-12 bg-white relative print:p-0 print:shadow-none form4-page">
            <div class="flex flex-col md:flex-row justify-between items-start gap-4 mb-10 no-print">
                <div>
                    <h3 class="text-indigo-900 font-black text-2xl">(ง.4) รายละเอียดคำชี้แจงรายการครุภัณฑ์</h3>
                    <p class="text-[11px] text-gray-400 font-bold mt-1">ข้อมูล <span class="text-red-500">*</span> สีแดง คือบังคับกรอกข้อมูล</p>
                </div>
                <div class="flex gap-2">
                    <input type="hidden" id="f4-edit-id">
                    <button onclick="App.saveForm4()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-xs">
                        <i data-lucide="save" size="16"></i> บันทึก
                    </button>
                    <button onclick="App.resetForm4()" class="bg-white text-gray-500 px-5 py-3 rounded-xl font-bold shadow-sm border border-indigo-100 flex items-center gap-2 text-xs hover:bg-indigo-50">
                        <i data-lucide="refresh-ccw" size="16"></i> ล้าง
                    </button>
                    <button onclick="window.print()" class="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                        <i data-lucide="printer"></i> Print / PDF
                    </button>
                </div>
            </div>

            <!-- หัวข้อกลาง -->
            <div class="text-center mb-10">
                <img src="logo.png" class="w-20 mx-auto mb-4" alt="RMUTP Logo">
                <h4 class="font-bold text-xl">มหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร</h4>
                <h5 class="font-bold text-lg text-slate-500">รายละเอียดคำชี้แจงค่าครุภัณฑ์</h5>
            </div>

            <div class="space-y-10">
                <!-- 1-3 -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-red-500">*1. หน่วยงาน</label>
                        <select id="f-dept" class="input-flat w-full"></select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-red-500">*2. สาขา / งาน</label>
                        <select id="f-branch" class="input-flat w-full"></select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-red-500">*3. แหล่งเงินงบประมาณ</label>
                        <div class="flex gap-2">
                            <select id="f-budget-source" class="input-flat flex-1"></select>
                            <input id="f-budget-other" placeholder="งบประมาณอื่นๆ (โปรดระบุ)" class="input-flat flex-1 text-xs">
                        </div>
                    </div>
                </div>

                <!-- 4-5 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-red-500">*4. รายการ</label>
                        <input id="f-item-name" placeholder="ชื่อรายการครุภัณฑ์" class="input-flat w-full">
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-bold text-red-500">*5. ประเภทครุภัณฑ์</label>
                        <div class="pl-4 space-y-3">
                            <div class="flex flex-col md:flex-row gap-2 items-start md:items-center text-xs">
                                <span class="font-bold text-gray-600">5.1 ครุภัณฑ์ประกอบอาคาร</span>
                                <input id="f-building-name" placeholder="ระบุชื่ออาคาร" class="input-flat py-2 flex-1 text-xs">
                                <span class="font-bold text-gray-600">สร้างเสร็จปีงบประมาณ</span>
                                <input id="f-building-year" placeholder="ปี งปม." class="input-flat py-2 w-28 text-xs">
                            </div>
                            <div class="flex flex-col md:flex-row gap-2">
                                <div class="flex items-center gap-2 flex-1">
                                    <span class="text-xs font-bold text-gray-600">5.2 ประเภท</span>
                                    <select id="f-category" class="input-flat flex-1"></select>
                                </div>
                                <input id="f-category-other" placeholder="ครุภัณฑ์อื่นๆ (โปรดระบุ)" class="input-flat flex-1 text-xs">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 6-10 -->
                <div class="space-y-6">
                    <div class="space-y-1.5">
                        <label class="text-xs font-bold text-red-500">*6. ความสอดคล้องกับประเด็นยุทธศาสตร์</label>
                        <select id="f-strat-issue" class="input-flat w-full"></select>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-1.5">
                            <div class="flex justify-between items-center">
                                <label class="text-xs font-bold text-red-500">*7. ความสอดคล้องกับวัตถุประสงค์เชิงยุทธศาสตร์</label>
                                <span class="text-[10px] font-bold text-gray-400"><span id="cnt-obj">0</span>/3000</span>
                            </div>
                            <textarea id="f-obj" maxlength="3000" rows="4" class="input-flat w-full" placeholder="พิมพ์..."></textarea>
                        </div>

                        <div class="space-y-1.5">
                            <div class="flex justify-between items-center">
                                <label class="text-xs font-bold text-red-500">*8. ความสอดคล้องกับกลยุทธ์</label>
                                <span class="text-[10px] font-bold text-gray-400"><span id="cnt-strategy">0</span>/3000</span>
                            </div>
                            <textarea id="f-strategy" maxlength="3000" rows="4" class="input-flat w-full" placeholder="พิมพ์..."></textarea>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <label class="text-xs font-bold text-red-500">*9. ความสอดคล้องกับมิติ</label>
                        <select id="f-bsc-dim" class="input-flat w-full"></select>
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-bold">10. สอดคล้องกับตัวชี้วัดความสำเร็จตามแผนพัฒนามหาวิทยาลัย</label>
                        <select id="f-strat-kpi" class="input-flat w-full"></select>

                        <div class="card-main p-6 bg-indigo-50/20 border border-indigo-100 rounded-[1.5rem] overflow-hidden">
                            <table class="w-full text-left text-sm">
                                <thead class="table-header">
                                    <tr class="bg-indigo-50/40">
                                        <th class="px-4 py-3">ตัวชี้วัดตามแผนพัฒนามหาวิทยาลัยฯ</th>
                                        <th class="px-4 py-3 text-center" colspan="2">ค่าเป้าหมาย</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-indigo-100">
                                    <tr>
                                        <td class="px-4 py-3"><input id="f-kpi-name" class="input-flat w-full bg-white" placeholder="ระบุ/หรือเลือกจากด้านบน"></td>
                                        <td class="px-4 py-3"><select id="f-kpi-unit" class="input-flat w-full bg-white"></select></td>
                                        <td class="px-4 py-3"><input id="f-kpi-target" class="input-flat w-full bg-white" placeholder="ค่าเป้าหมาย"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <p id="kpi-role-hint" class="text-[10px] text-gray-400 font-bold hidden">หมายเหตุ: รายการตัวชี้วัดข้อ 10 แสดงตามสิทธิ์ผู้ใช้</p>
                    </div>
                </div>

                <!-- 11-14 (ยังคงเพื่อให้ flow ต่อเนื่องก่อนถึง 15-18) -->
                <div class="space-y-8">
                    <div class="space-y-1.5">
                        <div class="flex justify-between items-center">
                            <label class="text-xs font-bold text-red-500">*11. เหตุผลความจำเป็น</label>
                            <span class="text-[10px] font-bold text-gray-400"><span id="cnt-need">0</span>/3000</span>
                        </div>
                        <textarea id="f-need" maxlength="3000" rows="6" class="input-flat w-full" placeholder="- ระบุความสำคัญ ความจำเป็นและเหตุผลในการพัฒนาโครงการใหม่
- ระบุ Problem Based / Project Based / Area Based / การทบทวนข้อมูล Base line / การทบทวนความก้าวหน้า ความทันสมัยของเทคโนโลยีเป็นต้น
- ระบุแนวทางการพัฒนาสิ่งใหม่ ตัวอย่างเช่น องค์ความรู้ใหม่ การพัฒนาเทคโนโลยี นวัตกรรม(Product, Service, Process and Managements) เป็นต้น
- โครงการเมื่อดำเนินการแล้วจะมีอะไรดีขึ้น อย่างไร ใครได้ประโยชน์ ใครนำไปใช้บ้าง"></textarea>
                    </div>

                    <div class="space-y-1.5">
                        <div class="flex justify-between items-center">
                            <label class="text-xs font-bold text-red-500">*12. วัตถุประสงค์ (ควรระบุสิ่งที่ต้องการทำให้สำเร็จเท่านั้น)</label>
                            <span class="text-[10px] font-bold text-gray-400"><span id="cnt-objective2">0</span>/3000</span>
                        </div>
                        <textarea id="f-objective2" maxlength="3000" rows="4" class="input-flat w-full" placeholder="พิมพ์..."></textarea>
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
        </div>`;
    },

    adminPage(subTab = 'tab1') {
        return `<div class="animate-in fade-in duration-500">
            <div class="flex gap-4 mb-8 no-print">
                <button onclick="App.switchSubTab('admin', 'tab1')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab1' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-purple-50'}">1. ตั้งต้นข้อมูล</button>
                <button onclick="App.switchSubTab('admin', 'tab2')" class="flex-1 py-4 px-6 rounded-2xl font-bold transition-all ${subTab === 'tab2' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-purple-50'}">2. จัดการผู้ใช้งานระบบ</button>
            </div>
            ${subTab === 'tab1' ? this.adminSetupDataTemplate() : this.adminUserTemplate()}
        </div>`;
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
                </div>
            </div>

            <!-- หมวดโครงสร้างองค์กร (ย้ายพื้นหลังเป็นสีขาว) -->
            <div class="card-main p-8 shadow-xl bg-white"><h5 class="font-black text-blue-800 flex items-center gap-2 mb-6"><i data-lucide="building-2" size="20"></i> หมวดโครงสร้างองค์กร</h5><div class="grid grid-cols-1 md:grid-cols-2 gap-8"><div class="bg-white p-6 rounded-[2rem] border border-blue-50 shadow-sm"><p class="text-[11px] font-black text-blue-600 mb-4 uppercase tracking-wider">หน่วยงาน</p><div class="flex gap-2"><input id="m-dept-name" placeholder="ใส่ข้อมูลหน่วยงาน" class="input-flat flex-1 border-blue-100"><button onclick="App.saveMaster('depts', 'm-dept-name')" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-md"><i data-lucide="save" size="18"></i> บันทึก</button></div></div><div class="bg-white p-6 rounded-[2rem] border border-blue-50 border-dashed shadow-sm"><p class="text-[11px] font-black text-blue-600 mb-4 uppercase tracking-wider">สาขา / งาน (เชื่อมโยงจากหน่วยงาน)</p><div class="space-y-3"><select id="m-dept-select" class="input-flat w-full border-blue-100 font-bold bg-gray-50"></select><div class="flex gap-2"><input id="m-branch-name" placeholder="ระบุชื่อสาขา/งาน..." class="input-flat flex-1 border-blue-100 italic"><button onclick="App.saveBranch()" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"><i data-lucide="link" size="18"></i> เชื่อมโยง</button></div></div></div></div></div>

            <!-- หมวดข้อมูลยุทธศาสตร์และตัวชี้วัด (โปรดระบุความเชื่อมโยง) -->
            <div class="card-main p-8 relative shadow-xl bg-white">
                <div class="rainbow-line absolute top-0 left-0 w-full h-[3px]"></div>
                <h5 class="font-black text-purple-800 flex items-center gap-2 mb-6"><i data-lucide="target" size="20"></i> หมวดข้อมูลยุทธศาสตร์และตัวชี้วัด (โปรดระบุความเชื่อมโยง)</h5>

                <div class="space-y-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-[11px] font-bold text-gray-500">แผนพัฒนามหาวิทยาลัยฉบับที่</label>
                        <div class="flex gap-2 items-center">
                            <input id="strat-lvl-9" placeholder="ระบุฉบับที่ ...." class="input-flat flex-1 text-sm bg-gray-50/50">
                            <button onclick="App.saveStratNew(9)" class="p-3 bg-purple-600 text-white rounded-xl shadow-md hover:bg-purple-700"><i data-lucide="save" size="18"></i></button>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 border-l-2 border-purple-100 pl-4">
                        <label class="text-[11px] font-bold text-gray-500">ความสอดคล้องกับประเด็นยุทธศาสตร์</label>
                        <div class="flex gap-2 items-center">
                            <select id="strat-parent-10" class="input-flat w-56 text-sm bg-gray-50/50 font-bold"></select>
                            <input id="strat-lvl-10" placeholder="เลือกฉบับที่ > ระบุยุทธศาสตร์ที่ ...." class="input-flat flex-1 text-sm bg-gray-50/50">
                            <button onclick="App.saveStratNew(10)" class="p-3 bg-purple-600 text-white rounded-xl shadow-md hover:bg-purple-700"><i data-lucide="link" size="18"></i></button>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 border-l-2 border-purple-100 pl-4">
                        <label class="text-[11px] font-bold text-gray-500">ความสอดคล้องกับมิติ Balanced Scorecard</label>
                        <div class="flex gap-2 items-center">
                            <select id="strat-parent-11" class="input-flat w-56 text-sm bg-gray-50/50 font-bold"></select>
                            <input id="strat-lvl-11" placeholder="เลือกฉบับที่ > ยุทธศาสตร์ที่> ระบุมิติที่ ...." class="input-flat flex-1 text-sm bg-gray-50/50">
                            <button onclick="App.saveStratNew(11)" class="p-3 bg-purple-600 text-white rounded-xl shadow-md hover:bg-purple-700"><i data-lucide="link" size="18"></i></button>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 border-l-2 border-purple-100 pl-4">
                        <label class="text-[11px] font-bold text-gray-500">สอดคล้องกับตัวชี้วัดความสำเร็จตามแผนพัฒนามหาวิทยาลัยเทคโนโลยี</label>
                        <div class="flex gap-2 items-center">
                            <select id="strat-parent-12" class="input-flat w-56 text-sm bg-gray-50/50 font-bold"></select>
                            <input id="strat-lvl-12" placeholder="เลือกฉบับที่ >ยุทธศาสตร์ที่ > มิติที่ > ระบุตัวชี้วัดที่ ...." class="input-flat flex-1 text-sm bg-gray-50/50">
                            <button onclick="App.saveStratNew(12)" class="p-3 bg-purple-600 text-white rounded-xl shadow-md hover:bg-purple-700"><i data-lucide="link" size="18"></i></button>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            
            <!-- หมวดการวิเคราะห์ครุภัณฑ์ตามวัตถุประสงค์ -->
            <div class="card-main p-8 relative shadow-xl bg-white">
                <div class="rainbow-line absolute top-0 left-0 w-full h-[3px]"></div>
                <h5 class="font-black text-indigo-900 flex items-center gap-2 mb-2"><i data-lucide="clipboard-check" size="20"></i> การวิเคราะห์ครุภัณฑ์ตามวัตถุประสงค์ (ผนวก ค.แนวทางการวิเคราะห์งบลงทุน (ครุภัณฑ์))</h5>
                <p class="text-[11px] text-gray-400 font-bold mb-6">เลือกได้ 1 กรณีเท่านั้น</p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
                        <input type="radio" name="analysis-case" value="1" class="accent-indigo-600" onchange="App.switchAnalysisCase(1)">
                        <span class="font-bold text-sm text-indigo-900">ทดแทนของเดิม (เพื่อรักษาปริมาณผลผลิต)</span>
                    </label>
                    <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
                        <input type="radio" name="analysis-case" value="2" class="accent-indigo-600" >
                        <span class="font-bold text-sm text-indigo-900">เพิ่มปริมาณเป้าหมายผลผลิต (กำลังเปิดใช้ทีหลัง)</span>
                    </label>
                    <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
                        <input type="radio" name="analysis-case" value="3" class="accent-indigo-600" >
                        <span class="font-bold text-sm text-indigo-900">เพิ่มคุณภาพ/ประสิทธิภาพ/ประสิทธิผล (กำลังเปิดใช้ทีหลัง)</span>
                    </label>
                    <label class="flex items-center gap-3 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 cursor-pointer hover:bg-indigo-50/40">
                        <input type="radio" name="analysis-case" value="4" class="accent-indigo-600" >
                        <span class="font-bold text-sm text-indigo-900">เพิ่มผลผลิตใหม่ (กำลังเปิดใช้ทีหลัง)</span>
                    </label>
                
                <div id="analysis-case-hint" class="card-main p-6 bg-indigo-50/30 border border-indigo-100 rounded-[2rem] mb-8 text-sm font-bold text-indigo-900">โปรดเลือก 1 กรณีด้านบน</div>

</div>

                <!-- Case 2-4 placeholders -->
                <div id="analysis-case-2" class="hidden card-main p-6 bg-white border border-indigo-50 rounded-[2rem] mb-8">
                    <div class="font-black text-indigo-900 mb-1">กรณี: เพิ่มปริมาณเป้าหมายผลผลิต</div>
                    <div class="text-[11px] font-bold text-gray-500">กำลังเปิดใช้ทีหลัง</div>
                </div>
                <div id="analysis-case-3" class="hidden card-main p-6 bg-white border border-indigo-50 rounded-[2rem] mb-8">
                    <div class="font-black text-indigo-900 mb-1">กรณี: เพิ่มคุณภาพ/ประสิทธิภาพ/ประสิทธิผล</div>
                    <div class="text-[11px] font-bold text-gray-500">กำลังเปิดใช้ทีหลัง</div>
                </div>
                <div id="analysis-case-4" class="hidden card-main p-6 bg-white border border-indigo-50 rounded-[2rem] mb-8">
                    <div class="font-black text-indigo-900 mb-1">กรณี: เพิ่มผลผลิตใหม่</div>
                    <div class="text-[11px] font-bold text-gray-500">กำลังเปิดใช้ทีหลัง</div>
                </div>

                <!-- Case 1 -->
                <div id="analysis-case-1" class="space-y-6 hidden">
                    <div class="bg-indigo-50/30 border border-indigo-100 rounded-[2rem] p-8">
                        <div class="flex items-center justify-between gap-4 mb-6">
                            <div>
                                <h6 class="font-black text-indigo-900">กรณี: ทดแทนของเดิม</h6>
                                <p class="text-[11px] text-gray-500 font-bold">ต้องมีข้อมูลในตารางประวัติการซ่อมบำรุง*</p>
                            </div>
                            <div class="flex gap-2">
                                <input type="hidden" id="analysis-edit-id">
                                <button onclick="App.saveAnalysisCase1()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-xs">
                                    <i data-lucide="save" size="16"></i> บันทึก
                                </button>
                                <button onclick="App.resetAnalysisCase1()" class="bg-white text-gray-500 px-5 py-3 rounded-xl font-bold shadow-sm border border-indigo-100 flex items-center gap-2 text-xs hover:bg-indigo-50">
                                    <i data-lucide="refresh-ccw" size="16"></i> ล้าง
                                </button>
                            </div>
                        </div>

                        <div class="space-y-5">
                            <div class="space-y-1.5">
                                <label class="text-xs font-bold text-indigo-900">ระบุความจำเป็นที่ต้องก่อสร้างเพื่อทดแทนครุภัณฑ์เดิม</label>
                                <textarea id="a1-q1" rows="3" class="input-flat w-full" placeholder="อธิบาย ...."></textarea>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-indigo-900">สภาพการใช้งานครุภัณฑ์เดิม (จำนวนปีที่ใช้งาน / ประวัติการซ่อมแซม)</label>
                                    <textarea id="a1-q2-history" rows="3" class="input-flat w-full" placeholder="จำนวนปีที่ใช้งาน / ประวัติการซ่อมแซม ..."></textarea>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-indigo-900">สถานะการใช้งานครุภัณฑ์เดิม (เลือก 1 ข้อ)</label>
                                    <div class="space-y-2">
                                        <label class="flex items-center gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q2-opt" value="2.1" class="accent-indigo-600" onchange="App.toggleCase1Option('a1-q2', '2.1')">
                                            <span class="font-bold text-xs text-gray-700">ใช้งานได้สมบูรณ์</span>
                                        </label>

                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q2-opt" value="2.2" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q2', '2.2')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">ใช้งานได้บางส่วนแต่ไม่สมบูรณ์ (เสื่อมสภาพ/คุณภาพต่ำ/เสียหาย)</div>
                                                <textarea id="a1-q2-2.2" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย .."></textarea>
                                            </div>
                                        </label>

                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q2-opt" value="2.3" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q2', '2.3')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">ไม่สามารถใช้งานได้</div>
                                                <textarea id="a1-q2-2.3" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย .."></textarea>
                                            </div>
                                        </label>

                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q2-opt" value="2.4" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q2', '2.4')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">อื่นๆ</div>
                                                <textarea id="a1-q2-2.4" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย .."></textarea>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-1.5">
                                <label class="text-xs font-bold text-indigo-900">สัดส่วนจำนวนกลุ่มเป้าหมาย ต่อจำนวนครุภัณฑ์ มีความเหมาะสม (เปรียบเทียบก่อนและหลังการจัดหาครุภัณฑ์ทดแทน)</label>
                                <textarea id="a1-q3" rows="3" class="input-flat w-full" placeholder="อธิบาย...."></textarea>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-indigo-900">สามารถใช้งานครุภัณฑ์ร่วมกับส่วนราชการอื่น (เลือก 1 ข้อ)</label>
                                    <div class="space-y-2">
                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q4-opt" value="4.1" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q4', '4.1')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">ได้</div>
                                                <textarea id="a1-q4-4.1" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย...."></textarea>
                                            </div>
                                        </label>
                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q4-opt" value="4.2" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q4', '4.2')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">ไม่ได้ เนื่องจาก</div>
                                                <textarea id="a1-q4-4.2" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย...."></textarea>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-indigo-900">สรุปทางเลือกการจัดหาครุภัณฑ์ใหม่ ทดแทนครุภัณฑ์เดิม (เลือก 1 ข้อ)</label>
                                    <div class="space-y-2">
                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q5-opt" value="5.1" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q5', '5.1')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">สามารถใช้งานครุภัณฑ์เดิมได้โดยไม่ต้องจัดหาทดแทน เนื่องจาก</div>
                                                <textarea id="a1-q5-5.1" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย...."></textarea>
                                            </div>
                                        </label>

                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q5-opt" value="5.2" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q5', '5.2')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">สามารถใช้งานครุภัณฑ์เดิมได้ โดยต้องปรับปรุงหรือซ่อมแซมครุภัณฑ์เดิม เนื่องจาก</div>
                                                <textarea id="a1-q5-5.2" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย...."></textarea>
                                            </div>
                                        </label>

                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q5-opt" value="5.3" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q5', '5.3')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">ไม่สามารถใช้งานครุภัณฑ์เดิม / ไม่คุ้มค่าที่จะซ่อมแซม ต้องจัดหาครุภัณฑ์ใหม่ทดแทน เนื่องจาก</div>
                                                <textarea id="a1-q5-5.3" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย...."></textarea>
                                            </div>
                                        </label>

                                        <label class="flex items-center gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q5-opt" value="5.4" class="accent-indigo-600" onchange="App.toggleCase1Option('a1-q5', '5.4')">
                                            <span class="font-bold text-xs text-gray-700">ขาดการยืนยันข้อมูลที่ชัดเจน ควรให้ตรวจสอบข้อมูลและทบทวนใหม่อีกครั้ง</span>
                                        </label>

                                        <label class="flex items-start gap-3 bg-white p-3 rounded-2xl border border-indigo-100 cursor-pointer">
                                            <input type="radio" name="a1-q5-opt" value="5.5" class="accent-indigo-600 mt-1" onchange="App.toggleCase1Option('a1-q5', '5.5')">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs text-gray-700">ทางเลือกอื่นๆ</div>
                                                <textarea id="a1-q5-5.5" rows="2" class="input-flat w-full mt-2 hidden" placeholder="อธิบาย...."></textarea>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ตารางแสดงผล (ไม่เกิน 10 รายการ) -->
                    <div class="card-main overflow-hidden border-white shadow-xl bg-white">
                        <div class="flex flex-col md:flex-row justify-between items-center no-print px-6 py-4 gap-4 border-b border-indigo-50">
                            <div class="flex gap-3 items-center bg-indigo-50/40 p-2 rounded-2xl border border-indigo-100">
                                <i data-lucide="search" class="text-indigo-500 w-5 h-5 ml-2"></i>
                                <input id="analysis-search-input" oninput="App.filterAnalysisTable()" placeholder="ค้นหาข้อมูล..." class="input-flat py-2 text-xs border-none bg-transparent focus:ring-0 w-56">
                            </div>
                            <div class="flex gap-2 items-center">
                                <button onclick="App.prevAnalysisPage()" class="p-2.5 bg-white rounded-xl shadow-sm text-gray-400 hover:text-indigo-600 transition-all border border-indigo-50"><i data-lucide="chevron-left" size="20"></i></button>
                                <div class="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md" id="analysis-page-info">หน้า 1</div>
                                <button onclick="App.nextAnalysisPage()" class="p-2.5 bg-white rounded-xl shadow-sm text-gray-400 hover:text-indigo-600 transition-all border border-indigo-50"><i data-lucide="chevron-right" size="20"></i></button>
                            </div>
                        </div>
                        <table class="w-full text-left text-sm">
                            <thead class="table-header">
                                <tr class="bg-indigo-50/40">
                                    <th class="px-6 py-4">วันที่บันทึก</th>
                                    <th class="px-6 py-4">สถานะครุภัณฑ์เดิม</th>
                                    <th class="px-6 py-4">สรุปทางเลือก</th>
                                    <th class="px-6 py-4 text-right w-40">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody id="analysis-table-body" class="divide-y divide-gray-50"></tbody>
                        </table>
                    </div>
                </div>
            </div>


            <!-- ตารางพร้อมค้นหาและแบ่งหน้า -->
            <div class="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
                <div class="flex flex-col md:flex-row justify-between items-center no-print px-4 gap-4"><div class="flex gap-3 items-center bg-white p-2 rounded-2xl shadow-sm border border-purple-50"><i data-lucide="search" class="text-purple-400 w-5 h-5 ml-2"></i><select id="search-table-sel" onchange="App.refreshTable()" class="input-flat py-2 text-xs font-bold border-none bg-transparent focus:ring-0"><option value="budget_types">ข้อมูลประเภทเงินงบประมาณ</option><option value="years">ข้อมูลปีงบประมาณ</option><option value="items">ข้อมูลรายการครุภัณฑ์</option><option value="categories">ข้อมูลประเภทครุภัณฑ์</option><option value="depts">ข้อมูลหน่วยงาน</option></select><input id="table-search-input" oninput="App.filterTableData()" placeholder="ค้นหาข้อมูล..." class="input-flat py-2 text-xs border-none bg-transparent focus:ring-0 w-48 border-l border-gray-100"></div><div class="flex gap-2 items-center"><button onclick="App.prevTablePage()" class="p-2.5 bg-white rounded-xl shadow-sm text-gray-400 hover:text-purple-600 transition-all"><i data-lucide="chevron-left" size="20"></i></button><div class="bg-purple-600 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md" id="table-page-info">หน้า 1</div><button onclick="App.nextTablePage()" class="p-2.5 bg-white rounded-xl shadow-sm text-gray-400 hover:text-purple-600 transition-all"><i data-lucide="chevron-right" size="20"></i></button></div></div>
                <div class="card-main overflow-hidden border-white shadow-2xl"><table class="w-full text-left"><thead class="table-header"><tr class="bg-purple-50/50"><th class="px-8 py-5 text-purple-900 font-black">รายการข้อมูลล่าสุด</th><th class="px-8 py-5 text-purple-900 font-black text-right w-40">จัดการข้อมูล</th></tr></thead><tbody id="master-table-body" class="divide-y divide-gray-50 bg-white"></tbody></table></div>
            </div>
        </div>`;
    },

    adminUserTemplate() {
        return `<div class="card-main relative overflow-hidden p-10"><div class="rainbow-line absolute top-0 left-0 w-full h-1"></div><h3 class="text-[#4c1d95] font-black text-2xl flex items-center gap-3 mb-10"><i data-lucide="users" size="28"></i> จัดการผู้ใช้งานระบบ</h3><div class="bg-[#f5f3ff] p-8 rounded-[2rem] border border-purple-100 shadow-sm mb-12"><div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 items-end"><input type="hidden" id="u-edit-id"><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">Username</label><input id="u-user" placeholder="ระบุชื่อผู้ใช้" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">Password</label><input id="u-pass" placeholder="ระบุรหัสผ่าน" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">ชื่อ-นามสกุล</label><input id="u-fullname" placeholder="ระบุชื่อ-สกุล" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">สิทธิ์การใช้งาน</label><select id="u-role" class="input-flat w-full bg-white font-bold"><option value="admin">ผู้ดูแลระบบ</option><option value="manager">ผู้บริหาร</option><option value="staff_central">เจ้าหน้าที่ส่วนกลาง</option><option value="staff_dept">เจ้าหน้าที่หน่วยงาน</option></select></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">ตำแหน่ง</label><input id="u-pos" placeholder="ระบุตำแหน่ง" class="input-flat w-full bg-white"></div><div class="space-y-1.5"><label class="text-[11px] font-bold text-gray-500 ml-1">หน่วยงาน</label><select id="u-dept-select" class="input-flat w-full bg-white font-bold"></select></div><div class="lg:col-span-2 flex gap-2"><button id="btn-save-user" onclick="App.saveUser()" class="flex-1 bg-[#10b981] hover:bg-green-600 text-white h-[46px] rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2"><i data-lucide="check-circle" size="18"></i> บันทึกข้อมูล</button><button onclick="App.resetUserForm()" class="bg-gray-100 text-gray-400 h-[46px] w-[46px] rounded-xl flex items-center justify-center hover:bg-gray-200"><i data-lucide="refresh-ccw" size="18"></i></button></div></div></div><div class="overflow-hidden border border-purple-50 rounded-[2rem] bg-white shadow-xl"><table class="w-full text-left text-sm"><thead class="table-header"><tr class="bg-indigo-50/50"><th class="px-6 py-5">Username</th><th class="px-6 py-5">Password</th><th class="px-6 py-5">ชื่อ - นามสกุล</th><th class="px-6 py-5 text-center">สิทธิ์</th><th class="px-6 py-5">ตำแหน่ง</th><th class="px-6 py-5">หน่วยงาน</th><th class="px-6 py-5 text-center">จัดการ</th></tr></thead><tbody id="user-list-body" class="divide-y divide-gray-50"></tbody></table></div></div>`;
    }
};