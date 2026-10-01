import { createElement, LayoutGrid, FileText, Copy, Music, ShieldCheck, RefreshCw, ChevronRight, ChevronDown, ArrowRight, Plus, CircleHelp, Bell, Clock, Check, Wallet, BookOpen, Download, Users, Upload, Info, Menu, LogOut, Eye, Lock, Mail, X, Sparkles, MapPin, Phone, Lightbulb, Leaf, Cpu, Search, Building2, HeartPulse, Wrench } from "lucide";

const symbols = { grid: LayoutGrid, file: FileText, copy: Copy, music: Music, shield: ShieldCheck, refresh: RefreshCw, chevron: ChevronRight, down: ChevronDown, arrow: ArrowRight, plus: Plus, help: CircleHelp, bell: Bell, clock: Clock, check: Check, wallet: Wallet, book: BookOpen, download: Download, users: Users, upload: Upload, info: Info, menu: Menu, logout: LogOut, eye: Eye, lock: Lock, mail: Mail, close: X, spark: Sparkles, pin: MapPin, phone: Phone, bulb: Lightbulb, leaf: Leaf, cpu: Cpu, search: Search, building: Building2, health: HeartPulse, wrench: Wrench };

export const icon = (name: string, cls = "") => createElement(symbols[name as keyof typeof symbols] || FileText, { class: `icon ${cls}`, width: 20, height: 20, "stroke-width": 1.65, "aria-hidden": "true" }).outerHTML;
export const fullName = "Pemetaan Inovasi Teknologi Tepat Guna Kota Bekasi";
export const logo = `<img class="pelita-logo" src="/images/pelita-logo.png" alt="PELITA Kota Bekasi" width="132" height="44" />`;
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
