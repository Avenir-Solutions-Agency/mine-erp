// State model of the demo page (docs/reference/demo.html, `S` and `SEQ`).
// Money is in Ft and weight in tonnes as JavaScript numbers, exactly like the demo (ARCHITECTURE.md §06).

export type Stage = "kitermeles" | "toro" | "rakodas" | "fuvar" | "rezsi";
export type AgentMode = "auto" | "suggest" | "off";
export type FlagLevel = "ok" | "warn" | "bad";

export interface Flag {
  lvl: FlagLevel;
  t: string;
}

export interface Policy {
  autoQuoteMaxNet: number;
  minMargin: number;
  targetMargin: number;
  autoInvoiceMaxGross: number;
  overDeliveryTol: number;
  truckT: number;
  density: Record<string, number> & { default: number };
  freightMarkup: number;
  tollPerTrip: number;
  vat: number;
  ekaerValueLimit: number;
  ekaerWeightKg: number;
  requireContract?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  does: string;
  mode: AgentMode;
}

export interface Site {
  id: string;
  name: string;
  zip: string;
}

export interface Depot {
  id: string;
  site: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  vtsz: string;
  price: number;
  factor: number;
  depot: string;
  min: number;
  src: "own" | "buy";
  buy?: number;
  aliases: string[];
  ekaer?: boolean;
  qhold?: boolean;
}

export interface Client {
  id: string;
  name: string;
  tax: string;
  zip: string;
  city: string;
  email: string;
  domain: string;
  limit: number;
  used: number;
  disc: number;
  payDays: number;
  end: boolean;
  billingoId?: string;
  hold?: boolean;
}

export interface Truck {
  id: string;
  name: string;
  type: string;
  cap: number;
  gross: string;
  vol: number;
  tip: string;
  cons: number;
  fuel: number;
  svcKm: number;
  mot: string;
  tacho: string;
  toll: string;
  euro: string;
  permit: string;
  ftkmAdj?: number;
  km: number;
  home: string;
  tare?: number;
  driver?: string;
}

export interface Machine {
  id: string;
  name: string;
  stage: Stage;
  h: number;
  dep: number;
  fuel: number;
  parts: number;
  next: number;
  svcEvery: number;
  src?: string;
  tare?: number;
  km?: number;
  toll?: number;
}

export interface StaffRow {
  name: string;
  stage: Stage;
  gross: number;
  h: number;
}

/** [name, stage, monthly Ft] */
export type OverheadRow = [string, Stage, number];

export interface Part {
  id: string;
  name: string;
  unit: string;
  qty: number;
  min: number;
  use: number;
  lead: number;
  price: number;
  sup: string;
  compat?: string[];
  loc?: string;
}

export interface StockMove {
  id: string;
  date: Date;
  pid: string;
  depot: string;
  qty: number;
  type: string;
  ref: string;
}

export interface InquiryLine {
  pid: string;
  qty: number;
  note: string;
}

export interface Extraction {
  lines: InquiryLine[];
  zip: string;
  city: string;
  addr: string;
  date: Date | null;
  company: string;
  clientId: string | null;
  conf: number;
  missing: string[];
  project?: string;
}

export interface Inquiry {
  id: string;
  channel: string;
  from: string;
  name: string;
  subject: string;
  received: Date;
  status: string;
  raw: string;
  clientId?: string | null;
  zip?: string;
  ex?: Extraction;
  conf?: number;
  quoteId?: string;
  reply?: string;
  claudeBusy?: boolean;
  directOrder?: string;
}

export interface PriceLine {
  pid: string;
  qty: number;
  note?: string;
  name: string;
  unitNet: number;
  unitCost: number;
  margin: number;
  rec: number;
  net: number;
}

export interface PriceResult {
  lines: PriceLine[];
  km: number;
  trips: number;
  freightCost: number;
  freightNet: number;
  freightPerT: number;
  prodNet: number;
  net: number;
  gross: number;
  margin: number;
  flags: Flag[];
  totalT: number;
}

export interface Quote {
  id: string;
  inq?: string;
  clientId: string | null;
  clientName: string;
  zip: string;
  city: string;
  addr: string;
  date: Date | null;
  pr: PriceResult;
  created: Date;
  valid: Date;
  status: string;
  orderId?: string;
  direct?: boolean;
}

export interface OrderLine {
  pid: string;
  qty: number;
  unitNet: number;
}

export interface Order {
  id: string;
  quote: string;
  clientId: string | null;
  clientName: string;
  zip: string;
  city: string;
  addr: string;
  lines: OrderLine[];
  freightPerT: number;
  delivered: Record<string, number>;
  planned: Record<string, number>;
  status: string;
  date: Date;
  created: Date;
  invoiced?: string;
  project?: string;
}

export interface Ekaer {
  required: boolean;
  reasons: string[];
  value: number;
  number: string | null;
  status: string;
  prepared?: Date | null;
  at?: Date;
  job?: string;
}

export interface Pod {
  name: string;
  t: Date;
  img: string;
  how: string;
  gps?: string;
  photo?: boolean;
}

export interface Transport {
  id: string;
  order: string;
  clientId: string | null;
  clientName: string;
  pid: string;
  planned: number;
  truck: string | null;
  driver: string;
  driverId?: string | null;
  date: Date;
  prefStart?: number;
  status: string;
  net: number | null;
  depot: string;
  ekaer: Ekaer;
  km?: number;
  start?: number | null;
  dur?: number;
  drive?: number;
  warn?: string[];
  wait?: number;
  dn?: string;
  inv?: string;
  tig?: string;
  pod?: Pod;
  _ovr?: boolean;
  _cOvr?: boolean;
}

export interface InvoiceItem {
  name: string;
  unit_price: number;
  unit_price_type: string;
  quantity: number;
  unit: string;
  vat: string;
  comment?: string;
}

/** A Billingo request body or other outbound payload; shown as JSON only. */
export type Payload = Record<string, unknown>;

export interface Doc {
  id: string;
  type: "Szállítólevél" | "Számla";
  kind?: string;
  ref: string;
  order: string;
  clientName: string;
  amount: number;
  qty?: number;
  pid?: string;
  gross?: number;
  items?: InvoiceItem[];
  status: string;
  status2?: string;
  number?: string | null;
  nav: string;
  created: Date;
  due?: Date;
  payAt?: Date | null;
  paid?: boolean;
  payload: Payload;
  pod?: Pod;
}

export interface Approval {
  id: string;
  kind: string;
  refId: string;
  title: string;
  reason: string;
  ai: string;
  status: string;
  t: Date;
}

export interface AuditEntry {
  t: Date;
  actor: string;
  what: string;
  ref: string;
}

export interface PurchaseOrder {
  id: string;
  sid: string;
  name: string;
  sup: string;
  qty: number;
  status: string;
  recvQty?: number;
}

export interface Issue {
  t: Date;
  sid: string;
  qty: number;
  machine: string;
  cost: number;
  labor?: boolean;
}

export interface Job {
  id: string;
  system: string;
  op: string;
  ref: string;
  payload: Payload;
  attempts: number;
  status: string;
  idem: string;
  t: Date;
  resp?: string;
  fn: () => string | void;
  onFail?: (j: Job) => void;
}

export interface Connection {
  sys: string;
  auth: string;
  scope: string;
  last: string;
}

export interface Dunning {
  doc: string;
  number: string;
  client: string;
  lvl: number;
  days: number;
  txt: string;
  status: string;
  t: Date;
}

export interface Followup {
  q: string;
  client: string;
  age: number;
  kind: string;
  txt: string;
  status: string;
}

export interface Survey {
  id: string;
  date: Date;
  depot: string;
  pid: string;
  m3: number;
  dens: number;
  t: number;
  book: number;
  diff: number;
  rel: number;
  method: string;
  status: string;
}

export interface WoKitLine {
  sid: string;
  q: number;
  ok: boolean;
}

export interface WoPartUse {
  sid: string;
  name: string;
  q: number;
  unit: string;
  cost: number;
}

export interface WorkOrder {
  id: string;
  machine: string;
  name: string;
  due: Date;
  kit: WoKitLine[];
  hours: number;
  status: string;
  mech?: string[];
  used?: WoPartUse[];
  start?: Date | null;
  end?: Date | null;
  ref?: string;
  jm?: string;
  done?: string;
  labor?: number;
  _ovr?: boolean;
}

export interface TankCheck {
  t: Date;
  book: number;
  dip: number;
  diff: number;
  rel: number;
}

export interface Shift {
  id: string;
  date: Date;
  recipe: string;
  site: string;
  inT: number;
  hours: number;
  who: string;
  out: { pid: string; t: number }[];
  loss: number;
  tph: number;
}

export interface LabSample {
  id: string;
  date: Date;
  pid: string;
  pass: boolean;
  note: string;
}

export interface Driver {
  id: string;
  name: string;
  lic: string;
  card: string;
  gki: string;
  weekH: number;
  fortH: number;
  restEnd: string;
  maxDay: number;
  ot: number;
  otCap: number;
  avail: string;
  skills: string;
  regions: string;
  custPref: string;
  eco: number;
  rate: number;
  perTrip: number;
  home: string;
}

export interface Leave {
  d: string;
  from: string;
  to: string;
  kind: string;
}

export interface RegistryEntry {
  no: string;
  date: Date;
  type: string;
  ref: string;
  title: string;
  by: string;
  hash: string;
}

/** [time, actor, text] */
export type HistoryEntry = [Date, string, string];

export interface Contract {
  id: string;
  order: string;
  clientId: string | null;
  clientName: string;
  created: Date;
  template: string;
  status: string;
  history: HistoryEntry[];
  sent?: Date;
  signed?: Date;
  signer?: string;
  sig?: string;
  how?: string;
  ik?: string;
}

export interface Tig {
  id: string;
  order: string;
  clientId: string | null;
  clientName: string;
  from: Date;
  to: Date;
  trips: string[];
  created: Date;
  status: string;
  history: HistoryEntry[];
  signer?: string;
  sig?: string;
  signedAt?: Date;
  ik?: string;
  objection?: string;
}

export interface ExtDeliveryNote {
  t: Date;
  img: string;
  name: string;
}

export interface TelemPoint {
  lat: number;
  lon: number;
  place: string;
  speed: number;
  ign: boolean;
  fuel: number;
  odo: number;
  upd: string;
}

export interface Trip {
  fid: string;
  truck: string | null;
  driver: string | null | undefined;
  date: Date;
  km: number;
  l: number;
  pts: [number, number][];
  from: string;
  to: string;
  stopMin: number;
  maxSpeed: number;
  idle: number;
}

export interface TelemEvent {
  t: string;
  truck: string;
  drv: string;
  ev: string;
}

export interface Refuel {
  t: string;
  truck: string;
  where: string;
  l: number;
  erp: number;
  ok: boolean;
}

export interface Inbound {
  id: string;
  sup: string;
  no: string;
  date: string;
  net: number;
  due: string;
  po: string;
  item: string;
  rec: string;
  status: string;
  ai?: { m: string | null; why: string };
  mach?: string | null;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  stage: Stage;
  kind: "driver" | "monthly";
  rate?: number;
  perTrip?: number;
  att: number;
  drive?: number;
  night: number;
  trips?: number;
  tripsOk?: number;
  wait?: number;
  leave: number;
  eco?: number;
  sunday?: number;
  gross?: number;
  shiftH?: number;
  woH?: number;
  live?: Transport[];
}

export interface Payroll {
  period: string;
  status: string;
  work: number;
  steps: [string, string, string][];
  periodKey: "szept" | "okt";
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface ProjectCost {
  t: Date;
  ref: string;
  kind: string;
  cost: number;
  item: string;
  qty: number;
}

export interface QrLogEntry {
  t: Date;
  mode: string;
  item: string;
  code: string;
  qty: number;
  unit: string;
  to: string;
  tcode: string;
  cost: number;
  costTo: string;
}

export interface MachineLog {
  id?: string;
  date: Date;
  machine: string;
  operator: string;
  src: string;
  hStart: number;
  hEnd: number;
  run: number;
  idle: number;
  idleReason: string;
  fault: string;
  photo?: string | null;
  prod: Record<string, number> | null;
  feed?: number;
}

export interface AnprEntry {
  t: string;
  plate: string;
  conf: number;
  fid?: string;
  match: string;
  net?: number;
  wait?: number;
  done?: boolean;
  exc?: string;
}

export interface LoadWait {
  t: Date;
  min: number;
  truck: string;
}

export interface WasteCode {
  code: string;
  name: string;
  price: number;
  ok: boolean;
}

export interface WastePartner {
  id: string;
  name: string;
  kuj: string;
  ktj: string;
  plates: string[];
  codes: string[];
}

export interface WasteEntry {
  id?: string;
  date: Date;
  partner: string;
  plate: string;
  code: string;
  gross: number;
  tare: number;
  net: number;
  doc: string;
  photo: string | null;
  fee?: number;
  taxFee?: number;
  inv?: string;
}

export interface FuelLogEntry {
  t: string;
  tag: string;
  m: string;
  l: number;
  cost: number;
}

export interface CardImport {
  truck: string;
  where: string;
  l: number;
  cost: number;
  it: number;
  ok: boolean;
}

export interface TruckStat {
  id: string;
  km: number;
  hours: number;
  cons: number;
  fuelL: number;
  tankL: number;
  diff: number;
  idlePct: number;
  over: number;
  harsh: number;
  stops: number;
}

export interface DriverStat {
  id: string;
  km: number;
  drive: number;
  eco: number;
  over: number;
  harsh: number;
  idle: number;
  cons: number;
}

export interface AskState {
  q: string;
  a: string;
  busy: boolean;
}

export interface State {
  policy: Policy;
  agents: Agent[];
  sites: Site[];
  depots: Depot[];
  products: Product[];
  /** [opening stock, produced, sold] in tonnes, September */
  vol: Record<string, [number, number, number]>;
  clients: Client[];
  trucks: Truck[];
  machines: Machine[];
  staff: StaffRow[];
  overhead: OverheadRow[];
  royaltyRate: number;
  diesel: number;
  szocho: number;
  parts: Part[];
  pnl: { months: string[]; rev: number[]; cost: number[] };
  stockMoves: StockMove[];
  inquiries: Inquiry[];
  quotes: Quote[];
  orders: Order[];
  transports: Transport[];
  docs: Doc[];
  approvals: Approval[];
  audit: AuditEntry[];
  pos: PurchaseOrder[];
  issues: Issue[];
  jobs: Job[];
  sim: { ekaerDown: boolean; billingoDown: boolean };
  conn: Connection[];
  ask: AskState;
  dunning: Dunning[];
  followups: Followup[];
  surveys: Survey[];
  wos: WorkOrder[];
  tank: TankCheck[];
  shifts: Shift[];
  lab: LabSample[];
  drivers: Driver[];
  leave: Leave[];
  registry: RegistryEntry[];
  ctemplate: string;
  contracts: Contract[];
  tigs: Tig[];
  extdn: ExtDeliveryNote[];
  telem: Record<string, TelemPoint>;
  trips: Trip[];
  tEvents: TelemEvent[];
  refuels: Refuel[];
  tstats: TruckStat[];
  dstats: DriverStat[];
  inbound: Inbound[];
  employees: Employee[];
  payroll: Payroll;
  locs: NamedRef[];
  projects: NamedRef[];
  units: NamedRef[];
  projCost?: ProjectCost[];
  qrlog: QrLogEntry[];
  mlog: MachineLog[];
  anpr: AnprEntry[];
  loadWait: LoadWait[];
  wcodes: WasteCode[];
  wpart: WastePartner[];
  wlog: WasteEntry[];
  wpolicy: { tax: number };
  fuelLog: FuelLogEntry[];
  cardImp?: CardImport[];
}

export type Seq = Record<string, number>;
