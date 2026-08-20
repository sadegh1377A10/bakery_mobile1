/* دستیار قنادی - نسخه‌ی مستقل موبایل (بدون سرور) */

let currentRoute = 'dashboard';
let routeParam = null;

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (isNaN(num)) return n;
  const s = Number.isInteger(num) ? num.toLocaleString('en-US') : num.toFixed(2).toLocaleString('en-US');
  return s.replace(/,/g, '\u066b');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function openSheet(contentEl) {
  const backdrop = document.getElementById('sheetBackdrop');
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = '';
  const handle = el('<div class="sheet-handle"></div>');
  sheet.appendChild(handle);
  sheet.appendChild(contentEl);
  backdrop.classList.add('show');
  requestAnimationFrame(() => sheet.classList.add('show'));
  Jalali.initDatepickers(sheet);
}

function closeSheet() {
  const backdrop = document.getElementById('sheetBackdrop');
  const sheet = document.getElementById('sheet');
  sheet.classList.remove('show');
  backdrop.classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);
});

function navigate(route, param = null) {
  currentRoute = route;
  routeParam = param;
  location.hash = param ? `${route}/${param}` : route;
  render();
  document.querySelectorAll('.bottom-nav button[data-route]').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === route);
  });
  document.getElementById('app-main').scrollTop = 0;
}

window.addEventListener('hashchange', () => {
  const parts = location.hash.replace('#', '').split('/');
  currentRoute = parts[0] || 'dashboard';
  routeParam = parts[1] || null;
  render();
});

async function render() {
  const main = document.getElementById('app-main');
  main.innerHTML = '<div class="empty-state">در حال بارگذاری...</div>';
  try {
    switch (currentRoute) {
      case 'dashboard': await renderDashboard(main); break;
      case 'products': await renderProductList(main); break;
      case 'product-detail': await renderProductDetail(main, routeParam); break;
      case 'materials': await renderMaterialList(main); break;
      case 'material-detail': await renderMaterialDetail(main, routeParam); break;
      case 'customers': await renderCustomerList(main); break;
      case 'orders': await renderOrderList(main); break;
      case 'order-detail': await renderOrderDetail(main, routeParam); break;
      case 'reports': await renderReports(main); break;
      case 'settings': await renderSettings(main); break;
      default: await renderDashboard(main);
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="empty-state">خطایی رخ داد: ${err.message}</div>`;
  }
}

// ---------------- Dashboard ----------------

async function renderDashboard(main) {
  const [products, materials, customers, orders] = await Promise.all([
    DB.getAll('products'), DB.getAll('materials'), DB.getAll('customers'), DB.getAll('orders'),
  ]);
  const recent = orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date)).slice(0, 5);
  const customerMap = {};
  customers.forEach((c) => { customerMap[c.id] = c; });

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>🏠 خانه</h2></div>
      <div class="grid grid-4">
        <div class="stat stat-a"><div class="num">${products.length}</div><div class="label">🧁 محصول</div></div>
        <div class="stat stat-b"><div class="num">${materials.length}</div><div class="label">🌾 ماده اولیه</div></div>
        <div class="stat stat-c"><div class="num">${orders.length}</div><div class="label">🧾 سفارش</div></div>
        <div class="stat stat-d"><div class="num">${customers.length}</div><div class="label">👤 مشتری</div></div>
      </div>
      <div class="card">
        <h3>آخرین سفارش‌ها</h3>
        ${recent.length ? `<table><tr><th>شماره</th><th>مشتری</th><th>زمان تحویل</th><th>وضعیت</th></tr>${recent.map((o) => `
          <tr onclick="navigate('order-detail','${o.id}')">
            <td>#${o.id}</td>
            <td>${customerMap[o.customer_id] ? customerMap[o.customer_id].first_name + ' ' + customerMap[o.customer_id].last_name : '—'}</td>
            <td>${Jalali.formatDateTime(o.delivery_date)}</td>
            <td><span class="badge badge-${o.status}">${statusLabel(o.status)}</span></td>
          </tr>`).join('')}</table>` : '<div class="empty">🍰 هنوز سفارشی ثبت نشده.</div>'}
      </div>
      <div class="grid grid-3">
        <button class="btn btn-a" onclick="navigate('products');openProductForm()">+ محصول جدید</button>
        <button class="btn btn-b" onclick="navigate('materials');openMaterialForm()">+ ماده اولیه جدید</button>
        <button class="btn btn-c" onclick="navigate('orders');openOrderForm()">+ ثبت سفارش جدید</button>
      </div>
    </div>
  `));
}

function statusLabel(s) {
  return { pending: 'در انتظار', in_progress: 'در حال آماده‌سازی', delivered: 'تحویل شده', cancelled: 'لغو شده' }[s] || s;
}

// ---------------- Materials ----------------

const UNIT_LABELS = { gram: 'گرم', kg: 'کیلوگرم', ml: 'میلی‌لیتر', lit: 'لیتر', adad: 'عدد' };

async function renderMaterialList(main, query = '') {
  let materials = await DB.getAll('materials');
  materials.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  if (query) {
    const q = query.trim();
    materials = materials.filter((m) => m.name.includes(q));
  }
  const allIngredients = await DB.getAll('product_ingredients');
  const usageCount = {};
  allIngredients.forEach((pi) => { usageCount[pi.material_id] = (usageCount[pi.material_id] || 0) + 1; });

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>مواد اولیه</h2><button class="btn btn-sm" style="width:auto" onclick="openMaterialForm()">+ جدید</button></div>
      <div class="searchbar">
        <input class="inp" id="materialSearch" type="text" placeholder="جستجو در نام ماده اولیه..." value="${query}">
      </div>
      ${materials.length ? materials.map((m) => `
        <div class="card-list-item" onclick="navigate('material-detail','${m.id}')">
          <div class="title-row"><span>${m.name}</span><span>${fmtMoney(m.purchase_price)} ت</span></div>
          <div class="sub">${UNIT_LABELS[m.unit] || m.unit} — استفاده در ${usageCount[m.id] || 0} محصول</div>
        </div>
      `).join('') : '<div class="empty">ماده اولیه‌ای یافت نشد.</div>'}
    </div>
  `));
  const searchInput = document.getElementById('materialSearch');
  searchInput.addEventListener('input', debounce(() => renderMaterialList(main, searchInput.value), 250));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

async function renderMaterialDetail(main, id) {
  const material = await DB.get('materials', id);
  if (!material) { main.innerHTML = '<div class="empty">یافت نشد.</div>'; return; }
  const ingredients = await DB.getByIndex('product_ingredients', 'material_id', id);
  const products = await DB.getAll('products');
  const productMap = {}; products.forEach((p) => { productMap[p.id] = p; });

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>${material.name}</h2><button class="btn btn-sm" style="width:auto" onclick="openMaterialForm(${material.id})">ویرایش</button></div>
      <div class="card">
        <p><b>واحد:</b> ${UNIT_LABELS[material.unit] || material.unit} — <b>قیمت خرید:</b> ${fmtMoney(material.purchase_price)} تومان
        ${material.note ? `<br><span class="muted">${material.note}</span>` : ''}</p>
      </div>
      <div class="card">
        <h3>در کدام محصولات استفاده می‌شود</h3>
        ${ingredients.length ? `<table><tr><th>محصول</th><th>مقدار مصرفی</th></tr>${ingredients.map((ing) => `
          <tr onclick="navigate('product-detail','${ing.product_id}')">
            <td>${productMap[ing.product_id] ? productMap[ing.product_id].name : '—'}</td>
            <td>${ing.quantity} ${UNIT_LABELS[material.unit] || ''}</td>
          </tr>`).join('')}</table>` : '<div class="empty">این ماده اولیه هنوز در هیچ محصولی استفاده نشده.</div>'}
      </div>
    </div>
  `));
}

function openMaterialForm(id = null) {
  (async () => {
    const material = id ? await DB.get('materials', id) : null;
    const form = el(`
      <form id="materialForm">
        <div class="sheet-header"><h3>${material ? 'ویرایش ماده اولیه' : 'ماده اولیه جدید'}</h3><button type="button" class="sheet-close" onclick="closeSheet()">✕</button></div>
        <label>نام ماده اولیه</label>
        <input class="inp" name="name" required value="${material ? material.name : ''}">
        <label>واحد اندازه‌گیری</label>
        <select class="inp" name="unit">
          ${Object.entries(UNIT_LABELS).map(([k, v]) => `<option value="${k}" ${material && material.unit === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <label>قیمت خرید (تومان به ازای واحد)</label>
        <input class="inp" name="purchase_price" type="number" step="0.01" value="${material ? material.purchase_price : 0}">
        <label>توضیحات</label>
        <input class="inp" name="note" value="${material ? (material.note || '') : ''}">
        <button type="submit" class="btn" style="margin-top:20px">ذخیره</button>
      </form>
    `);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const obj = {
        name: fd.get('name').trim(),
        unit: fd.get('unit'),
        purchase_price: parseFloat(fd.get('purchase_price')) || 0,
        note: fd.get('note').trim(),
        updated_at: new Date().toISOString(),
      };
      if (material) { obj.id = material.id; await DB.put('materials', obj); }
      else { await DB.add('materials', obj); }
      closeSheet();
      showToast('ماده اولیه ذخیره شد.');
      render();
    });
    openSheet(form);
  })();
}

// ---------------- Products ----------------

async function computeProductCost(productId) {
  const ingredients = await DB.getByIndex('product_ingredients', 'product_id', productId);
  let total = 0;
  for (const ing of ingredients) {
    const mat = await DB.get('materials', ing.material_id);
    if (mat) total += ing.quantity * mat.purchase_price;
  }
  return total;
}

async function renderProductList(main, query = '') {
  let products = await DB.getAll('products');
  products.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  const allIngredients = await DB.getAll('product_ingredients');
  const materials = await DB.getAll('materials');
  const materialMap = {}; materials.forEach((m) => { materialMap[m.id] = m; });

  if (query) {
    const q = query.trim();
    products = products.filter((p) => {
      if (p.name.includes(q)) return true;
      const ings = allIngredients.filter((i) => i.product_id === p.id);
      return ings.some((i) => materialMap[i.material_id] && materialMap[i.material_id].name.includes(q));
    });
  }

  const rows = await Promise.all(products.map(async (p) => {
    const ings = allIngredients.filter((i) => i.product_id === p.id);
    const cost = ings.reduce((sum, i) => sum + (materialMap[i.material_id] ? i.quantity * materialMap[i.material_id].purchase_price : 0), 0);
    const tags = ings.map((i) => materialMap[i.material_id] ? `<span class="tag">${materialMap[i.material_id].name}</span>` : '').join('');
    return `<div class="card-list-item" onclick="navigate('product-detail','${p.id}')">
      <div class="title-row"><span>${p.name}</span><span>${fmtMoney(cost)} ت</span></div>
      <div class="sub">${tags || 'بدون ماده اولیه'}</div>
    </div>`;
  }));

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>محصولات</h2><button class="btn btn-sm" style="width:auto" onclick="openProductForm()">+ جدید</button></div>
      <div class="searchbar"><input class="inp" id="productSearch" type="text" placeholder="جستجو در نام محصول یا مواد اولیه..." value="${query}"></div>
      ${rows.length ? rows.join('') : '<div class="empty">محصولی یافت نشد.</div>'}
    </div>
  `));
  const searchInput = document.getElementById('productSearch');
  searchInput.addEventListener('input', debounce(() => renderProductList(main, searchInput.value), 250));
}

async function renderProductDetail(main, id) {
  const product = await DB.get('products', id);
  if (!product) { main.innerHTML = '<div class="empty">یافت نشد.</div>'; return; }
  const ingredients = await DB.getByIndex('product_ingredients', 'product_id', id);
  const materials = await DB.getAll('materials');
  const materialMap = {}; materials.forEach((m) => { materialMap[m.id] = m; });
  const cost = ingredients.reduce((sum, i) => sum + (materialMap[i.material_id] ? i.quantity * materialMap[i.material_id].purchase_price : 0), 0);

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>${product.name}</h2><button class="btn btn-sm" style="width:auto" onclick="openProductForm(${product.id})">ویرایش</button></div>
      ${product.description ? `<p class="muted">${product.description}</p>` : ''}
      <div class="card">
        <h3>مواد اولیه و هزینه تمام‌شده</h3>
        ${ingredients.length ? `<table><tr><th>ماده اولیه</th><th>مقدار</th><th>واحد</th><th>قیمت واحد</th><th>هزینه</th></tr>${ingredients.map((ing) => {
          const m = materialMap[ing.material_id];
          if (!m) return '';
          return `<tr><td>${m.name}</td><td>${ing.quantity}</td><td>${UNIT_LABELS[m.unit] || m.unit}</td><td>${fmtMoney(m.purchase_price)}</td><td>${fmtMoney(ing.quantity * m.purchase_price)}</td></tr>`;
        }).join('')}</table>` : '<div class="empty">هنوز مواد اولیه‌ای برای این محصول ثبت نشده.</div>'}
        <div style="margin-top:14px">
          <span class="muted">جمع قیمت تمام‌شده: </span>
          <span class="cost-box">${fmtMoney(cost)} تومان</span>
          ${product.selling_price ? `<br><span class="muted">قیمت فروش: ${fmtMoney(product.selling_price)} تومان — سود: ${fmtMoney(product.selling_price - cost)} تومان</span>` : ''}
        </div>
      </div>
    </div>
  `));
}

async function openProductForm(id = null) {
  const product = id ? await DB.get('products', id) : null;
  const existingIngredients = id ? await DB.getByIndex('product_ingredients', 'product_id', id) : [];
  const materials = await DB.getAll('materials');
  materials.sort((a, b) => a.name.localeCompare(b.name, 'fa'));

  const form = el(`
    <form id="productForm">
      <div class="sheet-header"><h3>${product ? 'ویرایش محصول' : 'محصول جدید'}</h3><button type="button" class="sheet-close" onclick="closeSheet()">✕</button></div>
      <label>نام محصول</label>
      <input class="inp" name="name" required value="${product ? product.name : ''}">
      <label>توضیحات</label>
      <input class="inp" name="description" value="${product ? (product.description || '') : ''}">
      <label>قیمت فروش (تومان) - اختیاری</label>
      <input class="inp" name="selling_price" type="number" step="0.01" value="${product && product.selling_price ? product.selling_price : ''}">
      <h4 style="margin:18px 0 6px">مواد اولیه مصرفی</h4>
      <div id="ingredientRows"></div>
      <button type="button" class="formset-add" id="addIngredientBtn">+ افزودن ماده اولیه</button>
      <button type="submit" class="btn" style="margin-top:20px">ذخیره محصول</button>
    </form>
  `);

  const rowsContainer = form.querySelector('#ingredientRows');

  function addIngredientRow(materialId = '', quantity = '') {
    if (materials.length === 0) {
      showToast('اول باید حداقل یک ماده اولیه بسازید.');
      return;
    }
    const row = el(`
      <div class="formset-row">
        <div><label>ماده اولیه</label>
          <select class="inp ing-material">
            ${materials.map((m) => `<option value="${m.id}" ${String(m.id) === String(materialId) ? 'selected' : ''}>${m.name}</option>`).join('')}
          </select>
        </div>
        <div><label>مقدار مصرفی</label><input class="inp ing-qty" type="number" step="0.001" value="${quantity}"></div>
        <div><button type="button" class="formset-remove">✕</button></div>
      </div>
    `);
    row.querySelector('.formset-remove').addEventListener('click', () => row.remove());
    rowsContainer.appendChild(row);
  }

  existingIngredients.forEach((ing) => addIngredientRow(ing.material_id, ing.quantity));
  if (existingIngredients.length === 0) addIngredientRow();

  form.querySelector('#addIngredientBtn').addEventListener('click', () => addIngredientRow());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const obj = {
      name: fd.get('name').trim(),
      description: fd.get('description').trim(),
      selling_price: fd.get('selling_price') ? parseFloat(fd.get('selling_price')) : null,
    };
    let productId;
    if (product) { obj.id = product.id; await DB.put('products', obj); productId = product.id; }
    else { productId = await DB.add('products', obj); }

    // Replace ingredients
    for (const ing of existingIngredients) await DB.delete('product_ingredients', ing.id);
    const rows = rowsContainer.querySelectorAll('.formset-row');
    for (const row of rows) {
      const materialId = row.querySelector('.ing-material').value;
      const qty = parseFloat(row.querySelector('.ing-qty').value);
      if (materialId && qty) {
        await DB.add('product_ingredients', { product_id: productId, material_id: Number(materialId), quantity: qty });
      }
    }
    closeSheet();
    showToast('محصول ذخیره شد.');
    navigate('product-detail', productId);
  });

  openSheet(form);
}

// ---------------- Customers ----------------

async function renderCustomerList(main, query = '') {
  let customers = await DB.getAll('customers');
  customers.sort((a, b) => a.first_name.localeCompare(b.first_name, 'fa'));
  if (query) {
    const q = query.trim();
    customers = customers.filter((c) => `${c.first_name} ${c.last_name} ${c.phone}`.includes(q));
  }
  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>مشتریان</h2><button class="btn btn-sm" style="width:auto" onclick="openCustomerForm()">+ جدید</button></div>
      <div class="searchbar"><input class="inp" id="customerSearch" type="text" placeholder="جستجو در نام یا شماره تماس..." value="${query}"></div>
      ${customers.length ? customers.map((c) => `
        <div class="card-list-item" onclick="openCustomerForm(${c.id})">
          <div class="title-row"><span>${c.first_name} ${c.last_name}</span><span>${c.phone}</span></div>
          <div class="sub">${c.address || ''}</div>
        </div>`).join('') : '<div class="empty">مشتری‌ای یافت نشد.</div>'}
    </div>
  `));
  const searchInput = document.getElementById('customerSearch');
  searchInput.addEventListener('input', debounce(() => renderCustomerList(main, searchInput.value), 250));
}

async function openCustomerForm(id = null) {
  const customer = id ? await DB.get('customers', id) : null;
  const form = el(`
    <form id="customerForm">
      <div class="sheet-header"><h3>${customer ? 'ویرایش مشتری' : 'مشتری جدید'}</h3><button type="button" class="sheet-close" onclick="closeSheet()">✕</button></div>
      <label>نام</label><input class="inp" name="first_name" required value="${customer ? customer.first_name : ''}">
      <label>نام خانوادگی</label><input class="inp" name="last_name" value="${customer ? (customer.last_name || '') : ''}">
      <label>شماره تماس</label><input class="inp" name="phone" required value="${customer ? customer.phone : ''}">
      <label>آدرس</label><input class="inp" name="address" value="${customer ? (customer.address || '') : ''}">
      <button type="submit" class="btn" style="margin-top:20px">ذخیره</button>
      ${customer ? '<button type="button" class="btn btn-outline" style="margin-top:10px" id="deleteCustomerBtn">حذف مشتری</button>' : ''}
    </form>
  `);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const obj = {
      first_name: fd.get('first_name').trim(),
      last_name: fd.get('last_name').trim(),
      phone: fd.get('phone').trim(),
      address: fd.get('address').trim(),
    };
    if (customer) { obj.id = customer.id; await DB.put('customers', obj); }
    else { await DB.add('customers', obj); }
    closeSheet();
    showToast('مشتری ذخیره شد.');
    render();
  });
  if (customer) {
    form.querySelector('#deleteCustomerBtn').addEventListener('click', async () => {
      if (confirm('مشتری حذف شود؟')) {
        await DB.delete('customers', customer.id);
        closeSheet();
        showToast('مشتری حذف شد.');
        render();
      }
    });
  }
  openSheet(form);
}

// ---------------- Orders ----------------

async function computeOrderTotals(orderId) {
  const items = await DB.getByIndex('order_items', 'order_id', orderId);
  let cost = 0, price = 0;
  for (const it of items) {
    const product = await DB.get('products', it.product_id);
    const productCost = product ? await computeProductCost(product.id) : 0;
    cost += productCost * it.quantity;
    const unitPrice = it.unit_price != null ? it.unit_price : (product && product.selling_price ? product.selling_price : 0);
    price += unitPrice * it.quantity;
  }
  return { cost, price, itemCount: items.length };
}

async function renderOrderList(main) {
  let orders = await DB.getAll('orders');
  orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
  const customers = await DB.getAll('customers');
  const customerMap = {}; customers.forEach((c) => { customerMap[c.id] = c; });

  const rows = await Promise.all(orders.map(async (o) => {
    const totals = await computeOrderTotals(o.id);
    const c = customerMap[o.customer_id];
    return `<div class="card-list-item" onclick="navigate('order-detail','${o.id}')">
      <div class="title-row"><span>#${o.id} — ${c ? c.first_name + ' ' + c.last_name : '—'}</span><span>${fmtMoney(totals.price)} ت</span></div>
      <div class="sub">تحویل: ${Jalali.formatDateTime(o.delivery_date)} — <span class="badge badge-${o.status}">${statusLabel(o.status)}</span></div>
    </div>`;
  }));

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>سفارش‌ها</h2><button class="btn btn-sm" style="width:auto" onclick="openOrderForm()">+ جدید</button></div>
      ${rows.length ? rows.join('') : '<div class="empty">هنوز سفارشی ثبت نشده.</div>'}
    </div>
  `));
}

async function renderOrderDetail(main, id) {
  const order = await DB.get('orders', id);
  if (!order) { main.innerHTML = '<div class="empty">یافت نشد.</div>'; return; }
  const customer = await DB.get('customers', order.customer_id);
  const items = await DB.getByIndex('order_items', 'order_id', id);
  const products = await DB.getAll('products');
  const productMap = {}; products.forEach((p) => { productMap[p.id] = p; });
  const totals = await computeOrderTotals(id);

  const itemRows = await Promise.all(items.map(async (it) => {
    const p = productMap[it.product_id];
    const unitPrice = it.unit_price != null ? it.unit_price : (p && p.selling_price ? p.selling_price : 0);
    const pcost = p ? await computeProductCost(p.id) : 0;
    return `<tr><td>${p ? p.name : '—'}</td><td>${it.quantity}</td><td>${fmtMoney(unitPrice)}</td><td>${fmtMoney(pcost * it.quantity)}</td><td>${fmtMoney(unitPrice * it.quantity)}</td></tr>`;
  }));

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar">
        <h2>سفارش #${order.id}</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-b" style="width:auto" onclick="printInvoice('${order.id}')">🧾 فاکتور</button>
          <button class="btn btn-sm" style="width:auto" onclick="openOrderForm(${order.id})">ویرایش</button>
        </div>
      </div>
      <div class="card">
        <p><b>مشتری:</b> ${customer ? customer.first_name + ' ' + customer.last_name : '—'}<br>
        <b>تماس:</b> ${customer ? customer.phone : '—'}<br>
        ${customer && customer.address ? `<b>آدرس:</b> ${customer.address}<br>` : ''}
        <b>زمان ثبت:</b> ${Jalali.formatFull(order.order_date)}<br>
        <b>زمان تحویل:</b> ${Jalali.formatFull(order.delivery_date)}<br>
        <b>وضعیت:</b> <span class="badge badge-${order.status}">${statusLabel(order.status)}</span></p>
        ${order.note ? `<p class="muted">${order.note}</p>` : ''}
      </div>
      <div class="card">
        <h3>محصولات سفارش</h3>
        <table><tr><th>محصول</th><th>تعداد</th><th>قیمت واحد</th><th>هزینه تمام‌شده</th><th>مبلغ فروش</th></tr>${itemRows.join('')}</table>
        <div style="margin-top:14px">
          <span class="muted">جمع هزینه تمام‌شده: ${fmtMoney(totals.cost)} تومان</span><br>
          <span class="cost-box">جمع مبلغ فروش: ${fmtMoney(totals.price)} تومان</span>
        </div>
      </div>
    </div>
  `));
}

async function openOrderForm(id = null) {
  const order = id ? await DB.get('orders', id) : null;
  const existingItems = id ? await DB.getByIndex('order_items', 'order_id', id) : [];
  const customers = await DB.getAll('customers');
  customers.sort((a, b) => a.first_name.localeCompare(b.first_name, 'fa'));
  const products = await DB.getAll('products');
  products.sort((a, b) => a.name.localeCompare(b.name, 'fa'));

  let deliveryDateVal = '', deliveryTimeVal = '';
  if (order) {
    const d = new Date(order.delivery_date);
    deliveryDateVal = Jalali.formatDate(d);
    deliveryTimeVal = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const form = el(`
    <form id="orderForm">
      <div class="sheet-header"><h3>${order ? 'ویرایش سفارش' : 'ثبت سفارش جدید'}</h3><button type="button" class="sheet-close" onclick="closeSheet()">✕</button></div>
      <label>مشتری</label>
      <select class="inp" name="customer_id" required>
        <option value="">— انتخاب کنید —</option>
        ${customers.map((c) => `<option value="${c.id}" ${order && order.customer_id === c.id ? 'selected' : ''}>${c.first_name} ${c.last_name} (${c.phone})</option>`).join('')}
      </select>
      ${customers.length === 0 ? '<div class="muted" style="margin-top:6px">مشتری‌ای ثبت نشده — اول یک مشتری بسازید.</div>' : ''}
      <div class="datetime-row">
        <div><label>تاریخ تحویل (شمسی)</label><input class="inp jalali-date" name="delivery_date_j" placeholder="۱۴۰۵/۰۱/۰۱" value="${deliveryDateVal}" required></div>
        <div><label>ساعت تحویل</label><input class="inp" type="time" name="delivery_time" value="${deliveryTimeVal}"></div>
      </div>
      <label>وضعیت</label>
      <select class="inp" name="status">
        <option value="pending" ${!order || order.status === 'pending' ? 'selected' : ''}>در انتظار</option>
        <option value="in_progress" ${order && order.status === 'in_progress' ? 'selected' : ''}>در حال آماده‌سازی</option>
        <option value="delivered" ${order && order.status === 'delivered' ? 'selected' : ''}>تحویل شده</option>
        <option value="cancelled" ${order && order.status === 'cancelled' ? 'selected' : ''}>لغو شده</option>
      </select>
      <label>توضیحات</label>
      <input class="inp" name="note" value="${order ? (order.note || '') : ''}">
      <h4 style="margin:18px 0 6px">محصولات سفارش</h4>
      <div id="orderItemRows"></div>
      <button type="button" class="formset-add" id="addOrderItemBtn">+ افزودن محصول</button>
      <button type="submit" class="btn" style="margin-top:20px">ذخیره سفارش</button>
    </form>
  `);

  const rowsContainer = form.querySelector('#orderItemRows');

  function addItemRow(productId = '', qty = 1, unitPrice = '') {
    if (products.length === 0) {
      showToast('اول باید حداقل یک محصول بسازید.');
      return;
    }
    const row = el(`
      <div class="formset-row">
        <div><label>محصول</label>
          <select class="inp item-product">
            ${products.map((p) => `<option value="${p.id}" ${String(p.id) === String(productId) ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div><label>تعداد</label><input class="inp item-qty" type="number" min="1" value="${qty}"></div>
        <div><label>قیمت واحد (خالی=پیش‌فرض)</label><input class="inp item-price" type="number" step="0.01" value="${unitPrice}"></div>
        <div><button type="button" class="formset-remove">✕</button></div>
      </div>
    `);
    row.querySelector('.formset-remove').addEventListener('click', () => row.remove());
    rowsContainer.appendChild(row);
  }

  existingItems.forEach((it) => addItemRow(it.product_id, it.quantity, it.unit_price != null ? it.unit_price : ''));
  if (existingItems.length === 0) addItemRow();
  form.querySelector('#addOrderItemBtn').addEventListener('click', () => addItemRow());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const gdate = Jalali.parseJalaliDate(fd.get('delivery_date_j'));
    if (!gdate) { showToast('فرمت تاریخ درست نیست.'); return; }
    const timeStr = fd.get('delivery_time') || '00:00';
    const [hh, mm] = timeStr.split(':').map(Number);
    gdate.setHours(hh || 0, mm || 0, 0, 0);

    const obj = {
      customer_id: Number(fd.get('customer_id')),
      delivery_date: gdate.toISOString(),
      status: fd.get('status'),
      note: fd.get('note').trim(),
      order_date: order ? order.order_date : new Date().toISOString(),
    };
    let orderId;
    if (order) { obj.id = order.id; await DB.put('orders', obj); orderId = order.id; }
    else { orderId = await DB.add('orders', obj); }

    for (const it of existingItems) await DB.delete('order_items', it.id);
    const rows = rowsContainer.querySelectorAll('.formset-row');
    for (const row of rows) {
      const productId = row.querySelector('.item-product').value;
      const qty = parseInt(row.querySelector('.item-qty').value, 10);
      const priceVal = row.querySelector('.item-price').value;
      if (productId && qty) {
        await DB.add('order_items', {
          order_id: orderId,
          product_id: Number(productId),
          quantity: qty,
          unit_price: priceVal ? parseFloat(priceVal) : null,
        });
      }
    }
    closeSheet();
    showToast('سفارش ذخیره شد.');
    navigate('order-detail', orderId);
  });

  openSheet(form);
}

// ---------------- Invoice (print to PDF via browser) ----------------

async function printInvoice(orderId) {
  const order = await DB.get('orders', orderId);
  const customer = await DB.get('customers', order.customer_id);
  const items = await DB.getByIndex('order_items', 'order_id', orderId);
  const products = await DB.getAll('products');
  const productMap = {}; products.forEach((p) => { productMap[p.id] = p; });

  const rows = items.map((it) => {
    const p = productMap[it.product_id];
    const unitPrice = it.unit_price != null ? it.unit_price : (p && p.selling_price ? p.selling_price : 0);
    return `<tr><td>${p ? p.name : '—'}</td><td>${it.quantity}</td><td>${fmtMoney(unitPrice)}</td><td>${fmtMoney(unitPrice * it.quantity)}</td></tr>`;
  }).join('');
  const total = items.reduce((sum, it) => {
    const p = productMap[it.product_id];
    const unitPrice = it.unit_price != null ? it.unit_price : (p && p.selling_price ? p.selling_price : 0);
    return sum + unitPrice * it.quantity;
  }, 0);

  const printArea = document.getElementById('printArea');
  printArea.innerHTML = `
    <div style="font-family:'Vazirmatn',Tahoma,sans-serif;direction:rtl;padding:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #e08a2e;padding-bottom:14px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px">
          <img src="logo.png" style="width:60px;height:60px;border-radius:50%">
          <div><div style="font-size:12px;color:#9c8570">Sunlight Sweets</div></div>
        </div>
        <h1 style="color:#d1652a;margin:0;font-size:24px">فاکتور فروش</h1>
      </div>
      <table style="width:100%;margin-bottom:16px;border-collapse:collapse">
        <tr><td style="padding:4px 0"><b>شماره فاکتور:</b> #${order.id}</td><td style="padding:4px 0"><b>تاریخ صدور:</b> ${Jalali.formatDateTime(order.order_date)}</td></tr>
        <tr><td style="padding:4px 0"><b>نام مشتری:</b> ${customer.first_name} ${customer.last_name}</td><td style="padding:4px 0"><b>تاریخ تحویل:</b> ${Jalali.formatDateTime(order.delivery_date)}</td></tr>
        <tr><td style="padding:4px 0"><b>شماره تماس:</b> ${customer.phone}</td><td style="padding:4px 0"></td></tr>
        ${customer.address ? `<tr><td colspan="2" style="padding:4px 0"><b>آدرس:</b> ${customer.address}</td></tr>` : ''}
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr style="background:#fbead0"><th style="padding:8px;border:1px solid #f0e0c9">محصول</th><th style="padding:8px;border:1px solid #f0e0c9">تعداد</th><th style="padding:8px;border:1px solid #f0e0c9">قیمت واحد</th><th style="padding:8px;border:1px solid #f0e0c9">جمع</th></tr>
        ${rows.replace(/<td>/g, '<td style="padding:8px;border:1px solid #f0e0c9;text-align:center">')}
      </table>
      <div style="text-align:left;font-size:18px;font-weight:bold;color:#d1652a">مبلغ کل قابل پرداخت: ${fmtMoney(total)} تومان</div>
      ${order.note ? `<p style="color:#666;margin-top:14px">توضیحات: ${order.note}</p>` : ''}
      <div style="text-align:center;color:#9c8570;font-size:11px;margin-top:30px">Sunlight Sweets — دستیار قنادی</div>
    </div>
  `;
  window.print();
}

// ---------------- Reports ----------------

async function renderReports(main) {
  const orders = await DB.getAll('orders');
  const customers = await DB.getAll('customers');
  const products = await DB.getAll('products');
  const customerMap = {}; customers.forEach((c) => { customerMap[c.id] = c; });

  const byStatus = {};
  orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

  const byCustomer = {};
  orders.forEach((o) => {
    const key = o.customer_id;
    byCustomer[key] = (byCustomer[key] || 0) + 1;
  });

  const allItems = await DB.getAll('order_items');
  const byProduct = {};
  allItems.forEach((it) => {
    if (!byProduct[it.product_id]) byProduct[it.product_id] = { count: 0, qty: 0 };
    byProduct[it.product_id].count += 1;
    byProduct[it.product_id].qty += it.quantity;
  });
  const productMap = {}; products.forEach((p) => { productMap[p.id] = p; });

  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>گزارش‌ها</h2></div>
      <div class="stat" style="max-width:220px;margin-bottom:16px">
        <div class="num">${orders.length}</div><div class="label">تعداد کل سفارش‌ها</div>
      </div>
      <div class="card">
        <h3>سفارش‌ها بر اساس محصول</h3>
        ${Object.keys(byProduct).length ? `<table><tr><th>محصول</th><th>تعداد سفارش</th><th>مجموع فروخته‌شده</th></tr>${Object.entries(byProduct).map(([pid, v]) => `<tr><td>${productMap[pid] ? productMap[pid].name : '—'}</td><td>${v.count}</td><td>${v.qty}</td></tr>`).join('')}</table>` : '<div class="empty">داده‌ای یافت نشد.</div>'}
      </div>
      <div class="card">
        <h3>سفارش‌ها بر اساس مشتری</h3>
        ${Object.keys(byCustomer).length ? `<table><tr><th>مشتری</th><th>تعداد سفارش</th></tr>${Object.entries(byCustomer).map(([cid, count]) => `<tr><td>${customerMap[cid] ? customerMap[cid].first_name + ' ' + customerMap[cid].last_name : '—'}</td><td>${count}</td></tr>`).join('')}</table>` : '<div class="empty">داده‌ای یافت نشد.</div>'}
      </div>
      <div class="card">
        <h3>سفارش‌ها بر اساس وضعیت</h3>
        ${Object.keys(byStatus).length ? `<table><tr><th>وضعیت</th><th>تعداد</th></tr>${Object.entries(byStatus).map(([s, count]) => `<tr><td>${statusLabel(s)}</td><td>${count}</td></tr>`).join('')}</table>` : '<div class="empty">داده‌ای یافت نشد.</div>'}
      </div>
      <button class="btn" onclick="exportExcel()">📥 خروجی اکسل از همه‌ی سفارش‌ها</button>
    </div>
  `));
}

// ---------------- Excel export ----------------

async function exportExcel() {
  const orders = await DB.getAll('orders');
  const customers = await DB.getAll('customers');
  const products = await DB.getAll('products');
  const materials = await DB.getAll('materials');
  const allItems = await DB.getAll('order_items');
  const allIngredients = await DB.getAll('product_ingredients');

  const customerMap = {}; customers.forEach((c) => { customerMap[c.id] = c; });
  const productMap = {}; products.forEach((p) => { productMap[p.id] = p; });
  const materialMap = {}; materials.forEach((m) => { materialMap[m.id] = m; });

  const sheet1 = orders.map((o) => {
    const c = customerMap[o.customer_id] || {};
    const items = allItems.filter((it) => it.order_id === o.id);
    const price = items.reduce((s, it) => {
      const p = productMap[it.product_id];
      const up = it.unit_price != null ? it.unit_price : (p && p.selling_price ? p.selling_price : 0);
      return s + up * it.quantity;
    }, 0);
    return {
      'شماره سفارش': o.id, 'نام مشتری': c.first_name || '', 'نام خانوادگی': c.last_name || '',
      'شماره تماس': c.phone || '', 'آدرس': c.address || '',
      'زمان ثبت سفارش': Jalali.formatDateTime(o.order_date), 'زمان تحویل': Jalali.formatDateTime(o.delivery_date),
      'وضعیت': statusLabel(o.status), 'تعداد اقلام': items.length, 'مبلغ فروش (تومان)': price, 'توضیحات': o.note || '',
    };
  });

  const sheet2 = [];
  orders.forEach((o) => {
    const c = customerMap[o.customer_id] || {};
    allItems.filter((it) => it.order_id === o.id).forEach((it) => {
      const p = productMap[it.product_id];
      const up = it.unit_price != null ? it.unit_price : (p && p.selling_price ? p.selling_price : 0);
      sheet2.push({
        'شماره سفارش': o.id, 'مشتری': `${c.first_name || ''} ${c.last_name || ''}`,
        'محصول': p ? p.name : '', 'تعداد': it.quantity, 'قیمت واحد (تومان)': up, 'جمع مبلغ فروش (تومان)': up * it.quantity,
      });
    });
  });

  const sheet3 = [];
  orders.forEach((o) => {
    allItems.filter((it) => it.order_id === o.id).forEach((it) => {
      const p = productMap[it.product_id];
      if (!p) return;
      allIngredients.filter((ing) => ing.product_id === p.id).forEach((ing) => {
        const m = materialMap[ing.material_id];
        if (!m) return;
        const totalQty = ing.quantity * it.quantity;
        sheet3.push({
          'شماره سفارش': o.id, 'محصول': p.name, 'تعداد سفارش‌داده‌شده': it.quantity,
          'ماده اولیه': m.name, 'مقدار مصرفی برای یک عدد': ing.quantity, 'واحد': UNIT_LABELS[m.unit] || m.unit,
          'مقدار کل مصرفی': totalQty, 'قیمت واحد ماده (تومان)': m.purchase_price, 'هزینه کل (تومان)': totalQty * m.purchase_price,
        });
      });
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1), 'سفارش‌ها');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2), 'اقلام سفارش');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet3), 'مصرف مواد اولیه');
  XLSX.writeFile(wb, `orders_export_${Date.now()}.xlsx`);
}

// ---------------- Settings / Backup ----------------

async function renderSettings(main) {
  main.innerHTML = '';
  main.appendChild(el(`
    <div>
      <div class="topbar"><h2>⚙️ تنظیمات و پشتیبان‌گیری</h2></div>
      <div class="card">
        <h3>پشتیبان‌گیری از اطلاعات</h3>
        <p class="muted">چون این اپ داده‌ها را فقط روی همین گوشی نگه می‌دارد، پیشنهاد می‌شود هر چند وقت یک‌بار یک نسخه‌ی پشتیبان بگیرید — مخصوصاً قبل از تعویض گوشی یا حذف اپ.</p>
        <button class="btn" onclick="downloadBackup()">📥 دانلود فایل پشتیبان</button>
      </div>
      <div class="card">
        <h3>بازیابی از فایل پشتیبان</h3>
        <p class="muted">توجه: این کار همه‌ی اطلاعات فعلی را با اطلاعات داخل فایل پشتیبان جایگزین می‌کند.</p>
        <input type="file" id="restoreFile" accept="application/json" class="inp" style="padding:10px">
        <button class="btn btn-outline" style="margin-top:10px" onclick="restoreBackup()">📤 بازیابی از فایل</button>
      </div>
      <div class="card">
        <h3>درباره</h3>
        <p class="muted">دستیار قنادی — Sunlight Sweets<br>نسخه‌ی مستقل موبایل — تمام اطلاعات فقط روی همین گوشی ذخیره می‌شود.</p>
      </div>
    </div>
  `));
}

async function downloadBackup() {
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sunlight_sweets_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('فایل پشتیبان دانلود شد.');
}

async function restoreBackup() {
  const fileInput = document.getElementById('restoreFile');
  if (!fileInput.files.length) { showToast('یک فایل انتخاب کنید.'); return; }
  if (!confirm('همه‌ی اطلاعات فعلی جایگزین می‌شود. ادامه می‌دهید؟')) return;
  const text = await fileInput.files[0].text();
  try {
    const data = JSON.parse(text);
    await DB.importAll(data);
    showToast('بازیابی با موفقیت انجام شد.');
    navigate('dashboard');
  } catch (err) {
    showToast('فایل پشتیبان معتبر نیست.');
  }
}

// ---------------- Bootstrap ----------------

async function seedInitialDataIfEmpty() {
  const materials = await DB.getAll('materials');
  if (materials.length > 0) return;
  if (typeof SEED_DATA === 'undefined') return;
  for (const m of SEED_DATA.materials) {
    await DB.add('materials', m);
  }
  const materialsAfter = await DB.getAll('materials');
  const nameToId = {};
  materialsAfter.forEach((m) => { nameToId[m.name] = m.id; });
  for (const p of SEED_DATA.products) {
    const productId = await DB.add('products', { name: p.name, description: '', selling_price: null });
    for (const matName of p.materials) {
      if (nameToId[matName]) {
        await DB.add('product_ingredients', { product_id: productId, material_id: nameToId[matName], quantity: 0 });
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await seedInitialDataIfEmpty();
  const parts = location.hash.replace('#', '').split('/');
  currentRoute = parts[0] || 'dashboard';
  routeParam = parts[1] || null;
  render();
  document.querySelectorAll('.bottom-nav button[data-route]').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === currentRoute);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
