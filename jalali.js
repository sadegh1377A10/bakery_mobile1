/* تقویم شمسی: تبدیل تاریخ + دیتپیکر - مستقل و بدون کتابخانه‌ی خارجی */
const Jalali = (function () {
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const WEEKDAYS_FULL = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  function isLeapJalali(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    let bl = breaks.length, jp = breaks[0], jump = 0;
    for (let i = 1; i < bl; i += 1) {
      const jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      jp = jm;
    }
    let n = jy - jp;
    if (n < jump) {
      if (jump - n < 6) n = n - jump + Math.floor((jump + 4) / 33) * 33;
      let leap = ((n + 1) % 33) % 4;
      if (jump === 33 && leap === 1) leap = 0;
      return leap === 1;
    }
    return false;
  }

  function toGregorian(jy, jm, jd) {
    let gy = jy + 621;
    const jDaysInMonth = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    jy -= 979;
    gy -= 1600;
    let jDayNo = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4);
    for (let i = 0; i < jm - 1; i += 1) jDayNo += jDaysInMonth[i];
    jDayNo += jd - 1;
    let gDayNo = jDayNo + 79;
    let gy2 = 1600 + 400 * Math.floor(gDayNo / 146097);
    gDayNo = gDayNo % 146097;
    let leapG = true;
    if (gDayNo >= 36525) {
      gDayNo -= 1;
      gy2 += 100 * Math.floor(gDayNo / 36524);
      gDayNo = gDayNo % 36524;
      if (gDayNo >= 365) gDayNo += 1; else leapG = false;
    }
    gy2 += 4 * Math.floor(gDayNo / 1461);
    gDayNo %= 1461;
    if (gDayNo >= 366) {
      leapG = false;
      gDayNo -= 1;
      gy2 += Math.floor(gDayNo / 365);
      gDayNo = gDayNo % 365;
    }
    const gDaysInMonth = [31, (leapG ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    while (gm < 12 && gDayNo >= gDaysInMonth[gm]) {
      gDayNo -= gDaysInMonth[gm];
      gm += 1;
    }
    return new Date(gy2, gm, gDayNo + 1);
  }

  function fromGregorian(date) {
    const gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
    const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gy2 = gy - 1600, gm2 = gm - 1, gd2 = gd - 1;
    let gDayNo = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);
    for (let i = 0; i < gm2; i += 1) gDayNo += gDaysInMonth[i];
    if (gm2 > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) gDayNo += 1;
    gDayNo += gd2;
    let jDayNo = gDayNo - 79;
    const jNp = Math.floor(jDayNo / 12053);
    jDayNo %= 12053;
    let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
    jDayNo %= 1461;
    if (jDayNo >= 366) {
      jy += Math.floor((jDayNo - 1) / 365);
      jDayNo = (jDayNo - 1) % 365;
    }
    const jDaysInMonth = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    let jm = 0;
    while (jm < 11 && jDayNo >= jDaysInMonth[jm]) {
      jDayNo -= jDaysInMonth[jm];
      jm += 1;
    }
    return { jy, jm: jm + 1, jd: jDayNo + 1 };
  }

  function daysInMonth(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalali(jy) ? 30 : 29;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function formatDate(isoOrDate) {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    const j = fromGregorian(d);
    return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
  }

  function formatDateTime(isoOrDate) {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    const j = fromGregorian(d);
    return `${j.jy}/${pad(j.jm)}/${pad(j.jd)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatFull(isoOrDate) {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    const j = fromGregorian(d);
    const wd = WEEKDAYS_FULL[d.getDay()];
    return `${wd} ${j.jy}/${pad(j.jm)}/${pad(j.jd)} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function parseJalaliDate(str) {
    // "YYYY/MM/DD" -> Date (gregorian, local midnight)
    const parts = String(str).trim().replace(/-/g, '/').split('/').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return toGregorian(parts[0], parts[1], parts[2]);
  }

  function attachDatepicker(input) {
    if (input.dataset.jdpInit) return;
    input.dataset.jdpInit = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('readonly', 'readonly');

    const popup = document.createElement('div');
    popup.className = 'jdp-popup';
    document.body.appendChild(popup);

    let today = fromGregorian(new Date());
    let viewY = today.jy, viewM = today.jm;

    function render() {
      popup.innerHTML = '';
      const header = document.createElement('div');
      header.className = 'jdp-header';
      const prev = document.createElement('button');
      prev.type = 'button'; prev.className = 'jdp-nav'; prev.textContent = '›';
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'jdp-nav'; next.textContent = '‹';
      const label = document.createElement('span');
      label.className = 'jdp-label';
      label.textContent = MONTHS[viewM - 1] + ' ' + viewY;
      prev.onclick = () => { viewM -= 1; if (viewM < 1) { viewM = 12; viewY -= 1; } render(); };
      next.onclick = () => { viewM += 1; if (viewM > 12) { viewM = 1; viewY += 1; } render(); };
      header.appendChild(prev); header.appendChild(label); header.appendChild(next);
      popup.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'jdp-grid';
      WEEKDAYS.forEach((w) => {
        const wd = document.createElement('div');
        wd.className = 'jdp-weekday'; wd.textContent = w;
        grid.appendChild(wd);
      });

      const firstGDate = toGregorian(viewY, viewM, 1);
      const startOffset = (firstGDate.getDay() + 1) % 7;
      const total = daysInMonth(viewY, viewM);

      for (let i = 0; i < startOffset; i += 1) {
        const empty = document.createElement('div');
        empty.className = 'jdp-day jdp-empty';
        grid.appendChild(empty);
      }
      for (let d = 1; d <= total; d += 1) {
        const cell = document.createElement('div');
        cell.className = 'jdp-day';
        cell.textContent = d;
        if (d === today.jd && viewM === today.jm && viewY === today.jy) cell.classList.add('jdp-today');
        cell.onclick = () => {
          input.value = `${viewY}/${pad(viewM)}/${pad(d)}`;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        };
        grid.appendChild(cell);
      }
      popup.appendChild(grid);

      const footer = document.createElement('div');
      footer.className = 'jdp-footer';
      const todayBtn = document.createElement('button');
      todayBtn.type = 'button'; todayBtn.className = 'jdp-today-btn'; todayBtn.textContent = 'امروز';
      todayBtn.onclick = () => {
        const t = fromGregorian(new Date());
        input.value = `${t.jy}/${pad(t.jm)}/${pad(t.jd)}`;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      };
      footer.appendChild(todayBtn);
      popup.appendChild(footer);
    }

    function position() {
      const rect = input.getBoundingClientRect();
      popup.style.top = (window.scrollY + rect.bottom + 4) + 'px';
      popup.style.left = (window.scrollX + rect.left) + 'px';
    }

    function close() {
      popup.classList.remove('jdp-open');
      document.removeEventListener('mousedown', onOutside);
    }
    function onOutside(e) {
      if (!popup.contains(e.target) && e.target !== input) close();
    }
    function open() {
      const parts = (input.value || '').trim().split('/');
      if (parts.length === 3) { viewY = parseInt(parts[0], 10) || viewY; viewM = parseInt(parts[1], 10) || viewM; }
      render();
      position();
      popup.classList.add('jdp-open');
      document.addEventListener('mousedown', onOutside);
    }
    input.addEventListener('focus', open);
    input.addEventListener('click', open);
  }

  function initDatepickers(root = document) {
    root.querySelectorAll('input.jalali-date').forEach(attachDatepicker);
  }

  return {
    toGregorian, fromGregorian, formatDate, formatDateTime, formatFull, parseJalaliDate,
    attachDatepicker, initDatepickers, MONTHS, WEEKDAYS_FULL,
  };
})();
