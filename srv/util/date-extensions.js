Date.prototype.getLastDayOfMonth = function () {
  const year = this.getFullYear()
  const month = this.getMonth()
  return new Date(year, month + 1, 0).getDate()
}

Date.prototype.getFortnight = function () {
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
}

Date.prototype.getFortnightDays = function () {
  const {firstDate, lastDate} = this.getRelativeFortnight()
  const firstDay = firstDate.getDate()
  const lastDay = lastDate.getDate()
  return {firstDay, lastDay}
}

Date.prototype.equalsIgnoreTime = function (other) {
  return this.getDate() === other.getDate() &&
    this.getMonth() === other.getMonth() &&
    this.getFullYear() === other.getFullYear()
}

Date.prototype.isWeekendDay = function () {
  const day = this.getDay()
  return day === 6 || day === 0
}

Date.prototype.setHoursToBeginning = function () {
  return this.setHours(0, 0, 0, 0)
}

Date.prototype.setHoursToEnd = function () {
  return this.setHours(23, 59, 59, 999)
}