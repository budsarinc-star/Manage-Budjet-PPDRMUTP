const DataStore = {
    async getBudgetsOfYear(year, dept = 'all') {
        const colName = `budgets_${year}`;
        let query = db.collection('artifacts').doc('budget-pro-v001').collection('public').doc('data').collection(colName);
        if (dept !== 'all') query = query.where("dept", "==", dept);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async getMasterData(type) {
        const snap = await db.collection('artifacts').doc('budget-pro-v001').collection('public').doc('data').collection(type).orderBy('name').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
};