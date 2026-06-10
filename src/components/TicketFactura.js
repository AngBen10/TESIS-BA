'use client';

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';

/* Motor QR pure-JS (sin dependencias) */
const QR = (() => {
  const GF = new Uint8Array(256);
  const LG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF[i] = x; LG[x] = i;
      x = x < 128 ? x * 2 : (x * 2) ^ 0x11d;
    }
    GF[255] = GF[0]; LG[0] = 0;
  })();
  const gfMul = (a, b) => a && b ? GF[(LG[a] + LG[b]) % 255] : 0;
  const gfPow = (x, p) => GF[(LG[x] * p) % 255];
  function rsPoly(nec) {
    let g = [1];
    for (let i = 0; i < nec; i++) {
      const r = [1, gfPow(2, i)];
      const out = new Array(g.length + r.length - 1).fill(0);
      for (let j = 0; j < g.length; j++)
        for (let k = 0; k < r.length; k++)
          out[j + k] ^= gfMul(g[j], r[k]);
      g = out;
    }
    return g;
  }
  function rsEncode(data, nec) {
    const gen = rsPoly(nec);
    const rem = [...data, ...new Array(nec).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const c = rem[i];
      if (c) for (let j = 0; j < gen.length; j++) rem[i + j] ^= gfMul(gen[j], c);
    }
    return rem.slice(data.length);
  }
  const VER = [
    null,
    { size: 21, ec: 10, groups: [[1, 19]] },
    { size: 25, ec: 16, groups: [[1, 34]] },
    { size: 29, ec: 26, groups: [[1, 55]] },
    { size: 33, ec: 18, groups: [[2, 25]] },
    { size: 37, ec: 24, groups: [[2, 33]] },
    { size: 41, ec: 16, groups: [[4, 27]] },
    { size: 45, ec: 18, groups: [[4, 31]] },
    { size: 49, ec: 22, groups: [[2, 38], [2, 39]] },
    { size: 53, ec: 22, groups: [[3, 36], [2, 37]] },
    { size: 57, ec: 26, groups: [[4, 43], [1, 44]] },
  ];
  function encodeBytes(text) {
    const bytes = new TextEncoder().encode(text);
    const bits = [];
    const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
    push(0b0100, 4);
    push(bytes.length, 8);
    for (const b of bytes) push(b, 8);
    push(0b0000, 4);
    return bits;
  }
  function bitsToBytes(bits, cap) {
    while (bits.length < cap * 8) {
      bits.push(...[1, 1, 1, 0, 1, 1, 0, 0]);
      if (bits.length < cap * 8) bits.push(...[0, 0, 0, 1, 0, 0, 0, 1]);
    }
    bits.length = cap * 8;
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      out.push(b);
    }
    return out;
  }
  function chooseVersion(text) {
    const len = new TextEncoder().encode(text).length;
    for (let v = 1; v <= 10; v++) {
      const cap = VER[v].groups.reduce((s, [n, c]) => s + n * c, 0);
      if (len + 3 <= cap) return v;
    }
    return 10;
  }
  function interleave(version, data) {
    const { groups, ec } = VER[version];
    const blocks = [], ecBlocks = [];
    let off = 0;
    for (const [count, size] of groups) {
      for (let i = 0; i < count; i++) {
        const blk = data.slice(off, off + size);
        blocks.push(blk);
        ecBlocks.push(rsEncode(blk, ec));
        off += size;
      }
    }
    const out = [];
    const maxD = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < ec; i++) for (const b of ecBlocks) out.push(b[i]);
    return out;
  }
  function makeMatrix(size) { return Array.from({ length: size }, () => new Array(size).fill(null)); }
  function setFinder(m, r, c) {
    for (let dr = -1; dr <= 7; dr++)
      for (let dc = -1; dc <= 7; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= m.length || nc >= m[0].length) continue;
        m[nr][nc] = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6)
          ? (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
          : false;
      }
  }
  function setTiming(m, size) {
    for (let i = 8; i < size - 8; i++) {
      m[6][i] = m[i][6] = (i % 2 === 0);
    }
  }
  function setAlignment(m, version) {
    const pos = [
      [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
    ][version] || [];
    for (const r of pos) for (const c of pos) {
      if (m[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++)
          m[r + dr][c + dc] = (dr === -2 || dr === 2 || dc === -2 || dc === 2 || (dr === 0 && dc === 0));
    }
  }
  function isReserved(m, r, c) { return m[r][c] !== null; }
  function placeData(m, size, words) {
    const bits = [];
    for (const w of words) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);
    let idx = 0;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let row = 0; row < size; row++) {
        const actualRow = (Math.floor((size - 1 - col) / 2) % 2 === 0) ? (size - 1 - row) : row;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (!isReserved(m, actualRow, c)) {
            m[actualRow][c] = idx < bits.length ? bits[idx++] : false;
          }
        }
      }
    }
  }
  function applyMask(m, size) {
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (m[r][c] !== null && !isFormat(r, c, size))
          if ((r + c) % 2 === 0) m[r][c] = !m[r][c];
  }
  function isFormat(r, c, size) {
    return r < 9 && c < 9 || r < 9 && c >= size - 8 || r >= size - 8 && c < 9;
  }
  function setFormat(m, size) {
    const fmt = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
    const coords = [];
    for (let i = 0; i <= 5; i++) coords.push([8, i]);
    coords.push([8, 7], [8, 8], [7, 8]);
    for (let i = 5; i >= 0; i--) coords.push([i, 8]);
    const coords2 = [];
    for (let i = size - 1; i >= size - 8; i--) coords2.push([8, i]);
    for (let i = size - 7; i <= size - 1; i++) coords2.push([i, 8]);
    for (let i = 0; i < 15; i++) {
      m[coords[i][0]][coords[i][1]] = !!fmt[i];
      m[coords2[i][0]][coords2[i][1]] = !!fmt[i];
    }
    m[size - 8][8] = true;
  }
  function generate(text) {
    const version = chooseVersion(text);
    const { size, ec, groups } = VER[version];
    const cap = groups.reduce((s, [n, c]) => s + n * c, 0);
    const bits = encodeBytes(text);
    const dataBytes = bitsToBytes(bits, cap);
    const words = interleave(version, dataBytes);
    const m = makeMatrix(size);
    setFinder(m, 0, 0);
    setFinder(m, size - 7, 0);
    setFinder(m, 0, size - 7);
    setTiming(m, size);
    setAlignment(m, version);
    for (let i = 0; i < 9; i++) { m[8][i] = m[8][i] ?? false; m[i][8] = m[i][8] ?? false; }
    for (let i = size - 8; i < size; i++) { m[8][i] = m[8][i] ?? false; m[i][8] = m[i][8] ?? false; }
    placeData(m, size, words);
    applyMask(m, size);
    setFormat(m, size);
    return { matrix: m, size };
  }
  return { generate };
})();

const QRCanvas = ({ value, size = 90 }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!value || !canvasRef.current) return;
    try {
      const { matrix, size: qrSize } = QR.generate(value);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const scale = size / (qrSize + 8);
      const offset = 4 * scale;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000000';
      for (let r = 0; r < qrSize; r++)
        for (let c = 0; c < qrSize; c++)
          if (matrix[r][c])
            ctx.fillRect(
              Math.round(offset + c * scale),
              Math.round(offset + r * scale),
              Math.ceil(scale),
              Math.ceil(scale)
            );
    } catch (e) {
      console.error('[QRCanvas]', e);
    }
  }, [value, size]);
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: 'block', margin: '0 auto 4px', borderRadius: '2px' }}
    />
  );
};

const gs = (n) => Number(n || 0).toLocaleString('es-PY');

const calcIVA = (subtotal, tasa) => {
  if (tasa === '10') return Math.round(subtotal / 11);
  if (tasa === '5') return Math.round(subtotal / 21);
  return 0;
};

const calcTotalesIVA = (items) => {
  let base10 = 0, iva10 = 0, base5 = 0, iva5 = 0, exenta = 0;
  items.forEach((item) => {
    const sub = Number(item.subtotal || 0);
    if (item.tipoIva === '10') {
      const imp = calcIVA(sub, '10');
      iva10 += imp;
      base10 += sub - imp;
    } else if (item.tipoIva === '5') {
      const imp = calcIVA(sub, '5');
      iva5 += imp;
      base5 += sub - imp;
    } else {
      exenta += sub;
    }
  });
  return { base10, iva10, base5, iva5, exenta };
};

const S = {
  wrap: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '11px',
    width: '288px',
    padding: '12px 10px',
    background: '#fff',
    color: '#000',
    lineHeight: '1.45',
  },
  center: { textAlign: 'center' },
  dash: { borderTop: '1px dashed #999', margin: '5px 0' },
  solid: { borderTop: '1.5px solid #000', margin: '4px 0 5px' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '10px' },
  label: { color: '#555' },
};

const Separador = ({ doble }) => doble ? <div style={S.solid} /> : <div style={S.dash} />;

const FilaDato = ({ label, valor }) => (
  <div style={S.row}>
    <span style={S.label}>{label}</span>
    <span>{valor}</span>
  </div>
);

const ItemFactura = ({ item }) => {
  const labelIva = item.tipoIva === 'exenta' ? 'Exenta' : `IVA ${item.tipoIva || '10'}%`;
  return (
    <div style={{ marginBottom: '3px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ flex: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px' }}>
          {item.nombre}
        </span>
        <span style={{ flex: 1, textAlign: 'center', fontSize: '10px' }}>{item.cantidad}</span>
        <span style={{ flex: 2, textAlign: 'right', fontSize: '10px' }}>{gs(item.subtotal)}</span>
      </div>
      <div style={{ fontSize: '8px', color: '#666' }}>
        {gs(item.precioUnitario)} c/u · {labelIva}
      </div>
    </div>
  );
};

const BadgeSifen = ({ estado }) => {
  const cfg = {
    Aprobado: { bg: '#e6f4ee', color: '#0a6640', border: '#9fd4bb', texto: '✅ Aprobado SIFEN' },
    Pendiente: { bg: '#fff8e1', color: '#7a5c00', border: '#f0c040', texto: '⏳ Pendiente SIFEN' },
    Rechazado: { bg: '#fdecea', color: '#8b1a1a', border: '#f4b4b4', texto: '❌ Rechazado SIFEN' },
  }[estado] ?? { bg: '#f0f0f0', color: '#555', border: '#ccc', texto: estado };
  return (
    <span style={{
      display: 'inline-block', background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`, fontSize: '8px', fontWeight: 'bold',
      padding: '2px 7px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.4px',
    }}>
      {cfg.texto}
    </span>
  );
};

const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden !important; }
    #ticket-factura-80mm, #ticket-factura-80mm * { visibility: visible !important; }
    #ticket-factura-80mm {
      position: fixed !important; top: 0; left: 0;
      width: 72mm !important; font-size: 10pt !important; padding: 4mm !important;
    }
  }
  @page { size: 80mm auto; margin: 2mm; }
`;

const buildPrintHTML = (ticketId, numeroFactura) => {
  const el = document.getElementById(ticketId);
  if (!el) return null;
  return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8">
  <title>Factura ${numeroFactura}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 10pt; 
           width: 72mm; margin: 0 auto; padding: 4mm; background: #fff; color: #000; }
    @media print { @page { size: 80mm auto; margin: 2mm; } }
  </style>
</head><body>${el.innerHTML}</body></html>`;
};

const TicketFactura = forwardRef(({ datos = {} }, ref) => {

  // Estado para la configuración de la empresa en el ticket
  const [empresa, setEmpresa] = useState({
    nombre: datos.nombreFantasia || 'Restaurante',
    direccion: datos.direccion || '',
    telefono: datos.telefono || '',
    ruc: datos.rucEmisor || ''
  });

  useEffect(() => {
    fetch('/api/facturacion/configuracion')
      .then(res => res.json())
      .then(d => {
        if (d.config) {
          setEmpresa({
            nombre: d.config.EMPRESA_NOMBRE || d.config.SIFEN_NombreFantasia || datos.nombreFantasia || 'Restaurante',
            direccion: d.config.EMPRESA_DIRECCION || d.config.SIFEN_Direccion || datos.direccion || '',
            telefono: d.config.EMPRESA_TELEFONO || d.config.SIFEN_Telefono || datos.telefono || '',
            ruc: d.config.SIFEN_RUC || datos.rucEmisor || ''
          });
        }
      })
      .catch(() => { });
  }, [datos]);

  if (!datos || Object.keys(datos).length === 0) return null;

  const {
    timbrado = '',
    timbradoVigencia = '',
    establecimiento = '001',
    puntoExpedicion = '001',
    numeroFactura = '',
    fechaEmision = new Date().toISOString(),
    cdc = '',
    enlaceQR = '',
    estadoSifen = 'Aprobado',
    nombreCliente = 'CONSUMIDOR FINAL',
    rucCliente = 'X',
    metodoPago = 'Efectivo',
    montoEntregado = null,
    items = [],
    totalFactura = 0,
    isElectronica = true,
    isNotaCredito = false,
  } = datos;

  // Usamos los datos dinámicos extraídos de la configuración para imprimir
  const razonSocial = empresa.nombre;
  const nombreFantasia = empresa.nombre;
  const rucEmisor = empresa.ruc;
  const direccion = empresa.direccion;
  const telefono = empresa.telefono;

  const { base10, iva10, base5, iva5, exenta } = calcTotalesIVA(items);
  const vuelto = montoEntregado != null ? Number(montoEntregado) - Number(totalFactura) : null;

  const fecha = new Date(fechaEmision);
  const fechaStr = fecha.toLocaleDateString('es-PY');
  const horaStr = fecha.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  const TICKET_ID = 'ticket-factura-80mm';

  useImperativeHandle(ref, () => ({
    imprimir: () => {
      const html = buildPrintHTML(TICKET_ID, numeroFactura);
      if (!html) return;
      const pw = window.open('', '_blank', 'width=420,height=720');
      if (!pw) return;
      pw.document.write(html);
      pw.document.close();
      pw.focus();
      setTimeout(() => { pw.print(); pw.close(); }, 400);
    },
    getHTML: () => document.getElementById(TICKET_ID)?.outerHTML ?? '',
    getPrintHTML: () => buildPrintHTML(TICKET_ID, numeroFactura) ?? '',
  }), [numeroFactura]);

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div id={TICKET_ID} style={S.wrap}>
        {/* CABECERA */}
        <div style={{ ...S.center, marginBottom: '6px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{nombreFantasia}</div>
          <div style={{ fontSize: '8.5px', color: '#444' }}>{razonSocial}</div>
          <div style={{ fontSize: '8.5px' }}>RUC: {rucEmisor}</div>
          <div style={{ fontSize: '8.5px' }}>{direccion}</div>
          {telefono && <div style={{ fontSize: '8.5px' }}>Tel: {telefono}</div>}
        </div>
        <Separador />

        {/* DATOS FACTURA */}
        <div style={{ ...S.center, marginBottom: '4px' }}>
          <div style={{ fontSize: '9.5px', fontWeight: 'bold' }}>
            {isNotaCredito ? (isElectronica ? 'NOTA DE CRÉDITO ELECTRÓNICA' : 'NOTA DE CRÉDITO') : (isElectronica ? 'FACTURA ELECTRÓNICA' : 'FACTURA / TICKET')}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Nº {numeroFactura}</div>
          <div style={{ fontSize: '8.5px' }}>Timbrado: {timbrado} · Vigencia: {timbradoVigencia}</div>
          <div style={{ fontSize: '8.5px' }}>Est: {establecimiento} · Pto. Exp: {puntoExpedicion}</div>
        </div>
        <Separador />

        {/* CLIENTE */}
        <div style={{ marginBottom: '4px' }}>
          <FilaDato label="Cliente:" valor={nombreCliente} />
          {rucCliente && <FilaDato label="RUC/CI:" valor={rucCliente} />}
          <FilaDato label="Fecha:" valor={`${fechaStr} ${horaStr}`} />
          <FilaDato label="Pago:" valor={metodoPago} />
        </div>
        <Separador />

        {/* ENCABEZADO ITEMS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', fontWeight: 'bold', marginBottom: '2px' }}>
          <span style={{ flex: 3 }}>DESCRIPCIÓN</span>
          <span style={{ flex: 1, textAlign: 'center' }}>CANT</span>
          <span style={{ flex: 2, textAlign: 'right' }}>IMPORTE</span>
        </div>
        <Separador doble />

        {/* ITEMS */}
        {items.map((item, i) => <ItemFactura key={i} item={item} />)}
        <Separador />

        {/* IVA DESGLOSADO */}
        <div style={{ fontSize: '9px', marginBottom: '4px' }}>
          {(base10 > 0 || iva10 > 0) && <>
            <FilaDato label="Base gravada 10%" valor={`Gs. ${gs(base10)}`} />
            <FilaDato label="IVA 10%" valor={`Gs. ${gs(iva10)}`} />
          </>}
          {(base5 > 0 || iva5 > 0) && <div style={{ marginTop: '2px' }}>
            <FilaDato label="Base gravada 5%" valor={`Gs. ${gs(base5)}`} />
            <FilaDato label="IVA 5%" valor={`Gs. ${gs(iva5)}`} />
          </div>}
          <div style={{ marginTop: '2px' }}>
            <FilaDato label="Exentas" valor={`Gs. ${gs(exenta)}`} />
          </div>
        </div>
        <Separador doble />

        {/* TOTAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
          <span>TOTAL</span>
          <span>Gs. {gs(totalFactura)}</span>
        </div>

        {/* VUELTO */}
        {montoEntregado != null && (
          <div style={{ fontSize: '9px', marginTop: '3px' }}>
            <FilaDato label="Efectivo entregado" valor={`Gs. ${gs(montoEntregado)}`} />
            <FilaDato label="Vuelto" valor={`Gs. ${gs(vuelto)}`} />
          </div>
        )}
        <Separador />

        {/* CDC */}
        {(cdc && isElectronica) && (
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '8px', textAlign: 'center', marginBottom: '3px', color: '#444' }}>CÓDIGO DE CONTROL (CDC)</div>
            <div style={{ fontFamily: 'monospace', fontSize: '6.5px', wordBreak: 'break-all', background: '#f5f5f5', padding: '4px 5px', borderRadius: '3px', textAlign: 'center', color: '#333' }}>
              {cdc}
            </div>
          </div>
        )}

        {/* QR */}
        {isElectronica && (
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            {enlaceQR
              ? <QRCanvas value={enlaceQR} size={90} />
              : <div style={{ width: '90px', height: '90px', border: '1px dashed #ccc', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#999', textAlign: 'center' }}>QR<br />no disponible</div>
            }
            <div style={{ fontSize: '8px', color: '#555' }}>Escanee para verificar en e-Kuatia SET</div>
            <div style={{ marginTop: '4px' }}><BadgeSifen estado={estadoSifen} /></div>
          </div>
        )}
        <Separador />

        {/* PIE */}
        <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '4px' }}>
          <div>¡Gracias por su preferencia!</div>
          <div style={{ fontSize: '7.5px', color: '#777', marginTop: '4px' }}>Powered by ANGLEX Software {isElectronica && '· e-Kuatia Paraguay'}</div>
        </div>
      </div>
    </>
  );
});

TicketFactura.displayName = 'TicketFactura';
export default TicketFactura;