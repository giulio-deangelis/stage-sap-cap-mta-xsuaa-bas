sap.ui.define([], () => {
    'use strict'
    
    $.extend(Date.prototype, {
        
        getLastDayOfMonth() {
            const year = this.getFullYear()
            const month = this.getMonth()
            return new Date(year, month + 1, 0).getDate()
        },
        
        getFortnight() {
            const day = this.getDate()
            const year = this.getFullYear()
            const month = this.getMonth()
            let firstDate, lastDate
            
            if (day < 16) {
                firstDate = new Date(year, month, 1)
                lastDate = new Date(year, month, 15)
            } else {
                firstDate = new Date(year, month, 16)
                lastDate = new Date(year, month, this.getLastDayOfMonth())
            }

            firstDate.setHoursToBeginning()
            lastDate.setHoursToEnd()
            
            return {firstDate, lastDate}
        },
        
        getFortnightDays() {
            const {firstDate, lastDate} = this.getRelativeFortnight()
            const firstDay = firstDate.getDate()
            const lastDay = lastDate.getDate()
            return {firstDay, lastDay}
        },

        equalsIgnoreTime(other) {
            return this.getDate() === other.getDate() &&
                this.getMonth() === other.getMonth() &&
                this.getFullYear() === other.getFullYear()
        },

        isWeekendDay() {
          const day = this.getDay()
          return day === 6 || day === 0
        },

        setHoursToBeginning() {
          return this.setHours(0, 0, 0, 0)
        },

        setHoursToEnd() {
          return this.setHours(23, 59, 59, 999)
        }
    })
})