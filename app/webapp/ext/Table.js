sap.ui.define(['sap/m/Table'], (Table) => {
    
    $.extend(Table.prototype, {
        
        destroyRows() {
            for (const row of this.getItems()) {
                for (const cell of row.getCells())
                    cell.destroy()
            }
            this.unbindItems()
            this.removeAllColumns()
            return this
        }
    })
})