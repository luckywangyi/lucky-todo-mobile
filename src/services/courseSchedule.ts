import AsyncStorage from '@react-native-async-storage/async-storage'
import { CourseSlot } from '../types'

const COOKIE_KEY = 'lucky-todo-hub-cookie'
const SEMESTER_START_KEY = 'lucky-todo-semester-start'
const COURSES_KEY = 'lucky-todo-courses'

const COURSE_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316',
  '#14B8A6', '#6366F1', '#EF4444', '#10B981',
  '#F59E0B', '#06B6D4', '#A855F7', '#84CC16',
]

export async function saveCookie(cookie: string): Promise<void> {
  await AsyncStorage.setItem(COOKIE_KEY, cookie.trim())
}

export async function getCookie(): Promise<string | null> {
  return AsyncStorage.getItem(COOKIE_KEY)
}

export async function saveSemesterStart(dateStr: string): Promise<void> {
  await AsyncStorage.setItem(SEMESTER_START_KEY, dateStr)
}

export async function getSemesterStart(): Promise<string | null> {
  return AsyncStorage.getItem(SEMESTER_START_KEY)
}

export async function saveCourses(courses: CourseSlot[]): Promise<void> {
  await AsyncStorage.setItem(COURSES_KEY, JSON.stringify(courses))
}

export async function loadCourses(): Promise<CourseSlot[]> {
  const raw = await AsyncStorage.getItem(COURSES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function clearCourses(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(COURSES_KEY),
    AsyncStorage.removeItem(COOKIE_KEY),
    AsyncStorage.removeItem(SEMESTER_START_KEY),
  ])
}

export function getCurrentWeek(semesterStart: string): number {
  const start = new Date(semesterStart)
  const now = new Date()
  start.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

export function getTodayDayOfWeek(): number {
  const day = new Date().getDay()
  return day === 0 ? 7 : day
}

export function getTodayCourses(
  courses: CourseSlot[],
  semesterStart: string | null
): CourseSlot[] {
  if (!semesterStart || courses.length === 0) return []
  const dayOfWeek = getTodayDayOfWeek()
  const currentWeek = getCurrentWeek(semesterStart)
  if (currentWeek < 1 || currentWeek > 25) return []
  return courses.filter(
    (c) => c.dayOfWeek === dayOfWeek && c.weeks.includes(currentWeek)
  )
}

// 华科标准作息：节次 -> 时间（分钟）
const SECTION_TIME: Record<number, { start: number; end: number }> = {
  1:  { start: 8 * 60,        end: 8 * 60 + 45 },
  2:  { start: 8 * 60 + 55,   end: 9 * 60 + 40 },
  3:  { start: 10 * 60,       end: 10 * 60 + 45 },
  4:  { start: 10 * 60 + 55,  end: 11 * 60 + 40 },
  5:  { start: 14 * 60,       end: 14 * 60 + 45 },
  6:  { start: 14 * 60 + 55,  end: 15 * 60 + 40 },
  7:  { start: 16 * 60,       end: 16 * 60 + 45 },
  8:  { start: 16 * 60 + 55,  end: 17 * 60 + 40 },
  9:  { start: 18 * 60 + 30,  end: 19 * 60 + 15 },
  10: { start: 19 * 60 + 25,  end: 20 * 60 + 10 },
  11: { start: 20 * 60 + 20,  end: 21 * 60 + 5 },
  12: { start: 21 * 60 + 15,  end: 22 * 60 },
}

function sectionToTime(startSection: number, endSection: number) {
  const s = SECTION_TIME[startSection]
  const e = SECTION_TIME[endSection]
  if (!s || !e) return { startTime: 8 * 60, duration: 90 }
  return { startTime: s.start, duration: e.end - s.start }
}

function formatDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const HUB_BASE = 'http://mhub.hust.edu.cn'

function makeHeaders(cookie: string) {
  return {
    'Cookie': cookie,
    'Accept': 'application/json, text/plain, */*',
    'Referer': `${HUB_BASE}/kbPageController/by-date`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  }
}

async function hubGet(path: string, cookie: string, params?: Record<string, string>): Promise<any> {
  let url = `${HUB_BASE}${path}`
  if (params) {
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    url += `?${qs}`
  }
  const res = await fetch(url, { headers: makeHeaders(cookie) })
  const text = await res.text()
  if (text.includes('cas/login') || text.includes('redirectUrl')) {
    throw new Error('Cookie 已过期，请重新在浏览器登录 HUB 后复制新的 Cookie')
  }
  if (!res.ok) throw new Error(`请求 ${path} 失败: ${res.status}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function hubPost(path: string, cookie: string, params?: Record<string, string>): Promise<any> {
  let url = `${HUB_BASE}${path}`
  if (params) {
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    url += `?${qs}`
  }
  const res = await fetch(url, { method: 'POST', headers: makeHeaders(cookie) })
  const text = await res.text()
  if (text.includes('cas/login') || text.includes('redirectUrl')) {
    throw new Error('Cookie 已过期，请重新在浏览器登录 HUB 后复制新的 Cookie')
  }
  if (!res.ok) throw new Error(`请求 ${path} 失败: ${res.status}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * 解析 LsRefreshCourse 返回的课表数据
 * 格式: { data: [ { jcx: "1-2", kc: [ { KCMC, XM, QSZC, JSZC, JSMC, ... } ] } ] }
 */
function parseDayCourses(
  data: any,
  dayOfWeek: number,
  colorMap: Map<string, string>,
  colorIdx: { val: number },
  seen: Set<string>,
): CourseSlot[] {
  const courses: CourseSlot[] = []
  const items = data?.data || data || []
  if (!Array.isArray(items)) return courses

  for (const slot of items) {
    const jcx = String(slot.jcx || slot.JCX || '')
    const jcMatch = jcx.match(/(\d+)\s*[-–]\s*(\d+)/)
    let startSection = 0, endSection = 0
    if (jcMatch) {
      startSection = parseInt(jcMatch[1])
      endSection = parseInt(jcMatch[2])
    } else {
      const single = parseInt(jcx)
      if (!isNaN(single)) { startSection = single; endSection = single }
    }
    if (startSection < 1) continue

    const kcList = slot.kc || slot.KC || []
    if (!Array.isArray(kcList)) continue

    for (const kc of kcList) {
      const name = kc.KCMC || kc.kcmc || ''
      if (!name || name === '—') continue

      const teacher = kc.XM || kc.xm || ''
      const location = kc.JSMC || kc.jsmc || '待定'
      const startWeek = parseInt(kc.QSZC || kc.qszc || '1')
      const endWeek = parseInt(kc.JSZC || kc.jszc || '20')

      const weeks: number[] = []
      for (let w = startWeek; w <= endWeek; w++) weeks.push(w)

      const dedupeKey = `${name}-${dayOfWeek}-${startSection}-${endSection}-${startWeek}-${endWeek}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      if (!colorMap.has(name)) {
        colorMap.set(name, COURSE_COLORS[colorIdx.val % COURSE_COLORS.length])
        colorIdx.val++
      }

      const { startTime, duration } = sectionToTime(startSection, endSection)
      courses.push({
        id: `course-${dayOfWeek}-${startSection}-${endSection}-${courses.length}`,
        name,
        teacher: teacher === '—' ? '' : teacher,
        location: location === '—' ? '待定' : location,
        dayOfWeek,
        startTime,
        duration,
        weeks,
        color: colorMap.get(name)!,
      })
    }
  }
  return courses
}

/**
 * 从 HUB 系统获取完整学期课表
 */
export async function fetchCourseSchedule(cookie: string): Promise<CourseSlot[]> {
  const debugInfo: string[] = []

  // 1. 获取当前学期
  let xqh = ''
  let semesterStartDate = ''
  try {
    const xqData = await hubGet('/CommonController/xqOpthions', cookie)
    xqh = xqData?.xqOptions?.XQH || ''
    debugInfo.push(`学期接口: ${xqh || '无数据'}`)
  } catch (e: any) {
    debugInfo.push(`学期接口失败: ${e.message?.substring(0, 50)}`)
  }

  if (!xqh) {
    try {
      const xqList = await hubGet('/CommonController/getXqList', cookie)
      if (Array.isArray(xqList) && xqList.length > 0) {
        xqh = xqList[0].XQH || ''
        debugInfo.push(`学期列表: ${xqh}`)
      }
    } catch (e: any) {
      debugInfo.push(`学期列表失败: ${e.message?.substring(0, 50)}`)
    }
  }

  if (!xqh) {
    throw new Error(`无法获取学期信息。${debugInfo.join(' | ')}`)
  }

  // 2. 获取学期起止日期
  try {
    const xqInfo = await hubPost('/LsController/findXqh', cookie, { xqh })
    if (xqInfo?.qsrq) {
      semesterStartDate = xqInfo.qsrq
      debugInfo.push(`学期: ${xqh}, 起始: ${semesterStartDate}`)
    }
  } catch (e: any) {
    debugInfo.push(`学期详情失败: ${e.message?.substring(0, 50)}`)
  }

  // 3. 确定当前周次
  let currentWeek = 1
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  try {
    const zcData = await hubGet('/LsController/finddqzc', cookie, { xqh, rq: todayStr })
    if (zcData?.ZC) {
      currentWeek = parseInt(zcData.ZC)
      debugInfo.push(`当前周: ${currentWeek}`)
    }
  } catch (e: any) {
    debugInfo.push(`周次查询失败: ${e.message?.substring(0, 50)}`)
  }

  // 4. 获取一周每天的课表（周一到周日）
  // 先计算本周一的日期
  const dayOfWeek = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(monday.getDate() - (dayOfWeek - 1))

  const allCourses: CourseSlot[] = []
  const colorMap = new Map<string, string>()
  const colorIdx = { val: 0 }
  const seen = new Set<string>()
  let successCount = 0

  for (let d = 0; d < 7; d++) {
    const date = new Date(monday)
    date.setDate(date.getDate() + d)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dow = d + 1 // 1=周一, 7=周日

    try {
      const data = await hubGet('/LsController/LsRefreshCourse', cookie, {
        kcbxqh: xqh,
        sj: dateStr,
        zcstr: String(currentWeek),
      })
      const dayCourses = parseDayCourses(data, dow, colorMap, colorIdx, seen)
      allCourses.push(...dayCourses)
      successCount++
      if (dayCourses.length > 0) {
        debugInfo.push(`周${dow}: ${dayCourses.length}门`)
      }
    } catch (e: any) {
      debugInfo.push(`周${dow}失败: ${e.message?.substring(0, 40)}`)
    }
  }

  if (allCourses.length === 0 && successCount === 0) {
    throw new Error(
      `获取课表失败，请检查 Cookie 是否有效。\n\n` +
      `调试: ${debugInfo.join(' | ')}`
    )
  }

  if (allCourses.length === 0) {
    throw new Error(
      `本周无课程数据，可能是假期或学期尚未开始。\n\n` +
      `调试: ${debugInfo.join(' | ')}`
    )
  }

  // 自动计算并保存学期起始日期（第一周周一）
  let saved = false

  // 方法1: 从 API 返回的学期起始日期计算
  if (semesterStartDate) {
    const semStart = new Date(semesterStartDate.replace(/-/g, '/'))
    if (!isNaN(semStart.getTime())) {
      const semDow = semStart.getDay() || 7
      const weekOneMonday = new Date(semStart)
      weekOneMonday.setDate(semStart.getDate() - (semDow - 1))
      const computedStart = formatDateString(weekOneMonday)
      await saveSemesterStart(computedStart)
      saved = true
      debugInfo.push(`学期起始: ${computedStart}`)
    }
  }

  // 方法2: 用当前周次反推第一周周一（更可靠的回退方案）
  if (!saved && currentWeek >= 1) {
    const now = new Date()
    const nowDow = now.getDay() || 7
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - (nowDow - 1))
    const week1Monday = new Date(thisMonday)
    week1Monday.setDate(thisMonday.getDate() - (currentWeek - 1) * 7)
    const computedStart = formatDateString(week1Monday)
    await saveSemesterStart(computedStart)
    debugInfo.push(`反推起始: ${computedStart} (第${currentWeek}周)`)
  }

  return allCourses
}

/**
 * 通用解析：支持多种 HUB 返回格式（用于手动导入）
 */
export function parseManualJson(jsonStr: string): CourseSlot[] {
  const data = JSON.parse(jsonStr)
  const colorMap = new Map<string, string>()
  const colorIdx = { val: 0 }
  const seen = new Set<string>()

  // 尝试 LsRefreshCourse 格式 { data: [...] }
  if (data?.data && Array.isArray(data.data)) {
    const result = parseDayCourses(data, 0, colorMap, colorIdx, seen)
    if (result.length > 0) return result
  }

  // 尝试直接数组格式
  if (Array.isArray(data)) {
    // 可能是 [{jcx, kc}, ...] 格式
    if (data.length > 0 && data[0].kc) {
      const result = parseDayCourses({ data }, 0, colorMap, colorIdx, seen)
      if (result.length > 0) return result
    }
    // 可能是扁平课程列表
    return parseFlat(data, colorMap, colorIdx)
  }

  throw new Error('无法解析 JSON 数据格式')
}

function parseFlat(items: any[], colorMap: Map<string, string>, colorIdx: { val: number }): CourseSlot[] {
  const courses: CourseSlot[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const name = item.KCMC || item.kcmc || item.courseName || ''
    if (!name || name === '—') continue

    const teacher = item.XM || item.xm || item.teacherName || ''
    const location = item.JSMC || item.jsmc || item.classroomName || ''

    let dayOfWeek = parseInt(item.xqj || item.XQJ || item.dayOfWeek || '0')
    let startSection = 0, endSection = 0

    if (item.jc) {
      const m = String(item.jc).match(/(\d+)[-–](\d+)/)
      if (m) { startSection = parseInt(m[1]); endSection = parseInt(m[2]) }
    }
    if (!startSection && item.QSJC) startSection = parseInt(item.QSJC)
    if (!endSection && item.JSJC) endSection = parseInt(item.JSJC)

    const startWeek = parseInt(item.QSZC || item.qszc || '1')
    const endWeek = parseInt(item.JSZC || item.jszc || '20')
    const weeks: number[] = []
    for (let w = startWeek; w <= endWeek; w++) weeks.push(w)

    if (!name || dayOfWeek < 1 || startSection < 1) continue

    const dedupeKey = `${name}-${dayOfWeek}-${startSection}-${endSection}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    if (!colorMap.has(name)) {
      colorMap.set(name, COURSE_COLORS[colorIdx.val % COURSE_COLORS.length])
      colorIdx.val++
    }

    const { startTime, duration } = sectionToTime(startSection, endSection || startSection)
    courses.push({
      id: `course-${courses.length}-${dayOfWeek}-${startSection}`,
      name, teacher, location, dayOfWeek, startTime, duration, weeks,
      color: colorMap.get(name)!,
    })
  }
  return courses
}
