import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { impactLight, notificationSuccess } from '../lib/haptics'
import { crossAlert } from '../lib/alert'
import useStore from '../store/useStore'
import { getTheme, ThemeColors, TASK_TITLE_COLOR } from '../theme/colors'
import { typography } from '../theme/typography'
import { Project, ProjectPhase, TaskStatus } from '../types'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import { isAIConfigured, generateProjectPlan } from '../services/ai'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const projectColors = [
  { id: 'blue', color: '#3B82F6' },
  { id: 'green', color: '#10B981' },
  { id: 'purple', color: '#8B5CF6' },
  { id: 'orange', color: '#F97316' },
  { id: 'pink', color: '#EC4899' },
  { id: 'cyan', color: '#06B6D4' },
]

const projectIcons = ['📱', '🎮', '📚', '💻', '🎨', '🎵', '💪', '✈️', '🏠', '💼', '🧪', '🌱']

const statusLabels: Record<string, string> = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
}
const statusColors = (theme: ThemeColors) => ({
  pending: theme.textSecondary,
  in_progress: theme.primary,
  completed: theme.success,
})

const nextStatus = (s: TaskStatus): TaskStatus => {
  if (s === 'pending') return 'in_progress'
  if (s === 'in_progress') return 'completed'
  return 'pending'
}

const getProjectProgress = (project: Project) => {
  if (project.phases.length === 0) return 0
  const totalTasks = project.phases.reduce((sum, p) => sum + p.tasks.length, 0)
  const completedTasks = project.phases.reduce((sum, p) => sum + p.tasks.filter(t => t.completed).length, 0)
  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
}

const getProjectTaskCounts = (project: Project) => {
  const total = project.phases.reduce((s, p) => s + p.tasks.length, 0)
  const completed = project.phases.reduce((s, p) => s + p.tasks.filter(t => t.completed).length, 0)
  return { total, completed }
}

const getPhaseProgress = (phase: ProjectPhase) => {
  if (phase.tasks.length === 0) return phase.status === 'completed' ? 100 : 0
  const completed = phase.tasks.filter(t => t.completed).length
  return Math.round((completed / phase.tasks.length) * 100)
}

// --- Circular Progress Component ---
const CircularProgress = ({ size, progress, color, trackColor, textSize, showText = true }: {
  size: number; progress: number; color: string; trackColor: string; textSize?: number; showText?: boolean
}) => {
  const strokeWidth = Math.max(3, size * 0.1)
  const radius = (size - strokeWidth) / 2
  const clampedProgress = Math.min(100, Math.max(0, progress))

  // We build the circle with 4 quadrant clips for pure View rendering
  const renderHalf = (isRight: boolean) => {
    const rotation = isRight
      ? Math.min(clampedProgress, 50) * 3.6
      : Math.max(0, clampedProgress - 50) * 3.6

    if ((isRight && clampedProgress <= 0) || (!isRight && clampedProgress <= 50)) {
      return null
    }

    return (
      <View style={{
        position: 'absolute',
        width: size / 2,
        height: size,
        left: isRight ? size / 2 : 0,
        overflow: 'hidden',
      }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          position: 'absolute',
          left: isRight ? -size / 2 : 0,
          transform: [{ rotate: `${isRight ? rotation - 180 : rotation}deg` }],
          borderTopColor: isRight ? color : 'transparent',
          borderRightColor: isRight ? color : 'transparent',
          borderBottomColor: isRight ? 'transparent' : color,
          borderLeftColor: isRight ? 'transparent' : color,
        }} />
      </View>
    )
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: trackColor,
        position: 'absolute',
      }} />
      {renderHalf(true)}
      {renderHalf(false)}
      {showText && (
        <Text style={{ fontSize: textSize || size * 0.28, fontWeight: '700', color }}>
          {clampedProgress}%
        </Text>
      )}
    </View>
  )
}

// --- Status Badge Component ---
const StatusBadge = ({ status, color, onPress }: {
  status: TaskStatus; color: string; onPress?: () => void
}) => {
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.statusBadge, { backgroundColor: color + '18' }]}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[typography.small, { color, fontWeight: '600' }]}>
        {statusLabels[status] || status}
      </Text>
    </Wrapper>
  )
}

const ProjectsScreen = () => {
  const {
    projects, tasks, themeColor, darkMode,
    addProject, updateProject, deleteProject,
    addProjectPhase, updateProjectPhase, deleteProjectPhase,
    toggleProjectTask, promoteProjectTask,
  } = useStore()
  const theme = getTheme(themeColor, darkMode)
  const insets = useSafeAreaInsets()
  const tabBarHeight = 64 + Math.max(insets.bottom, 12)
  const sColors = statusColors(theme)

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddPhase, setShowAddPhase] = useState(false)
  const [showAddTask, setShowAddTask] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIcon, setNewIcon] = useState('📱')
  const [newColor, setNewColor] = useState('#3B82F6')

  const [phaseTitle, setPhaseTitle] = useState('')
  const [phaseDesc, setPhaseDesc] = useState('')
  const [taskTitle, setTaskTitle] = useState('')

  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiPlanLoading, setAiPlanLoading] = useState(false)
  useEffect(() => { isAIConfigured().then(setAiAvailable) }, [])

  // Track which project tasks are already linked to daily tasks
  const linkedProjectTaskIds = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach(t => {
      if (t.projectTaskId && !t.deletedAt) set.add(t.projectTaskId)
    })
    return set
  }, [tasks])

  const handleAIGeneratePlan = async () => {
    if (!newTitle.trim() || aiPlanLoading) return
    setAiPlanLoading(true)
    try {
      const plan = await generateProjectPlan(newTitle.trim(), newDesc.trim())
      addProject({
        title: newTitle.trim(),
        description: newDesc.trim(),
        icon: newIcon,
        color: newColor,
        phases: [],
        status: 'pending',
      })
      const newProjects = useStore.getState().projects
      const created = newProjects[newProjects.length - 1]
      if (created && plan.phases.length > 0) {
        for (const phase of plan.phases) {
          addProjectPhase(created.id, {
            title: phase.title,
            description: phase.description,
            status: 'pending',
            tasks: phase.tasks.map((t: any, i: number) => ({
              id: `ai-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: typeof t === 'string' ? t : (t.title || t.name || t.task || JSON.stringify(t)),
              completed: false,
            })),
          })
        }
        setSelectedProject(created)
      }
      resetCreateForm()
      crossAlert('AI 规划完成', `已生成 ${plan.phases.length} 个阶段`)
    } catch (err: any) {
      crossAlert('AI 规划失败', err?.message || '请重试')
    }
    setAiPlanLoading(false)
  }

  const currentProject = useMemo(() => {
    if (!selectedProject) return null
    return projects.find(p => p.id === selectedProject.id) || null
  }, [selectedProject, projects])

  const resetCreateForm = () => {
    setNewTitle('')
    setNewDesc('')
    setNewIcon('📱')
    setNewColor('#3B82F6')
    setShowCreateModal(false)
  }

  const handleCreateProject = () => {
    if (!newTitle.trim()) return
    addProject({
      title: newTitle.trim(),
      description: newDesc.trim(),
      icon: newIcon,
      color: newColor,
      phases: [],
      status: 'pending',
    })
    resetCreateForm()
  }

  const handleDeleteProject = (project: Project) => {
    crossAlert('删除项目', `确定删除「${project.title}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        deleteProject(project.id)
        if (selectedProject?.id === project.id) setSelectedProject(null)
      }},
    ])
  }

  const handleAddPhase = () => {
    if (!phaseTitle.trim() || !currentProject) return
    addProjectPhase(currentProject.id, {
      title: phaseTitle.trim(),
      description: phaseDesc.trim(),
      status: 'pending',
      tasks: [],
    })
    setPhaseTitle('')
    setPhaseDesc('')
    setShowAddPhase(false)
  }

  const handleAddTask = (phaseId: string) => {
    if (!taskTitle.trim() || !currentProject) return
    const phase = currentProject.phases.find(p => p.id === phaseId)
    if (!phase) return
    const newTask = { id: Date.now().toString(), title: taskTitle.trim(), completed: false }
    updateProjectPhase(currentProject.id, phaseId, {
      tasks: [...phase.tasks, newTask],
    })
    setTaskTitle('')
    setShowAddTask(null)
  }

  const handleDeletePhase = (phaseId: string) => {
    if (!currentProject) return
    crossAlert('删除阶段', '确定删除该阶段？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteProjectPhase(currentProject.id, phaseId) },
    ])
  }

  const handleTogglePhaseStatus = (phaseId: string, currentStatus: TaskStatus) => {
    if (!currentProject) return
    impactLight()
    updateProjectPhase(currentProject.id, phaseId, { status: nextStatus(currentStatus) })
  }

  const handlePromoteTask = (phaseId: string, taskId: string) => {
    if (!currentProject) return
    const result = promoteProjectTask(currentProject.id, phaseId, taskId)
    if (result) {
      notificationSuccess()
      crossAlert('已添加到日程', '任务已添加到今日待办，可在时间轴中安排')
    }
  }

  // Sort: active projects first, completed last
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const pa = getProjectProgress(a)
      const pb = getProjectProgress(b)
      if (pa === 100 && pb !== 100) return 1
      if (pa !== 100 && pb === 100) return -1
      return 0
    })
  }, [projects])

  const stats = useMemo(() => {
    const active = projects.filter(p => {
      const prog = getProjectProgress(p)
      return prog > 0 && prog < 100
    }).length
    const done = projects.filter(p => getProjectProgress(p) === 100).length
    return { total: projects.length, active, done }
  }, [projects])

  // ===================== PROJECT DETAIL VIEW =====================
  if (currentProject) {
    const progress = getProjectProgress(currentProject)
    const { total: totalTasks, completed: completedTasks } = getProjectTaskCounts(currentProject)

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Gradient header */}
        <View style={[styles.detailHeader, { backgroundColor: currentProject.color + '12' }]}>
          <View style={styles.detailHeaderTop}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.card }]}
              onPress={() => setSelectedProject(null)}
            >
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.heading2, { color: theme.text }]}>
                {currentProject.icon} {currentProject.title}
              </Text>
              {currentProject.description ? (
                <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                  {currentProject.description}
                </Text>
              ) : null}
            </View>
            <CircularProgress
              size={48}
              progress={progress}
              color={currentProject.color}
              trackColor={theme.surfaceSecondary}
            />
          </View>
          <View style={styles.detailStats}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              {completedTasks}/{totalTasks} 任务完成 · {currentProject.phases.length} 个阶段
            </Text>
            <StatusBadge
              status={progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending'}
              color={progress === 100 ? theme.success : progress > 0 ? currentProject.color : theme.textSecondary}
            />
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Timeline phases */}
          {currentProject.phases.map((phase, index) => {
            const pProgress = getPhaseProgress(phase)
            const isLast = index === currentProject.phases.length - 1
            const phaseColor = sColors[phase.status] || theme.textSecondary

            return (
              <View key={phase.id} style={styles.timelineRow}>
                {/* Left timeline */}
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: phaseColor, borderColor: phaseColor + '30' },
                  ]} />
                  {!isLast && (
                    <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                  )}
                </View>

                {/* Right content card */}
                <TouchableOpacity
                  style={[styles.phaseCard, {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    ...theme.cardShadow,
                  }]}
                  activeOpacity={0.9}
                  onLongPress={() => {
                    impactLight()
                    handleDeletePhase(phase.id)
                  }}
                >
                  <View style={styles.phaseCardHeader}>
                    <Text style={[typography.bodyMedium, { color: theme.text, flex: 1 }]}>{phase.title}</Text>
                    <StatusBadge
                      status={phase.status}
                      color={phaseColor}
                      onPress={() => handleTogglePhaseStatus(phase.id, phase.status)}
                    />
                  </View>

                  {phase.description ? (
                    <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]} numberOfLines={2}>
                      {phase.description}
                    </Text>
                  ) : null}

                  {/* Phase progress thin bar */}
                  <View style={[styles.thinProgressBg, { backgroundColor: theme.surfaceSecondary, marginTop: 10 }]}>
                    <View style={[styles.thinProgressFill, {
                      width: `${pProgress}%`,
                      backgroundColor: phaseColor,
                    }]} />
                  </View>

                  {/* Tasks */}
                  {phase.tasks.map(task => {
                    const isLinked = linkedProjectTaskIds.has(task.id)
                    return (
                      <View key={task.id} style={styles.taskRow}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => {
                            impactLight()
                            toggleProjectTask(currentProject.id, phase.id, task.id)
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={task.completed ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={task.completed ? theme.success : theme.textSecondary}
                          />
                          <Text style={[
                            typography.body,
                            { color: task.completed ? theme.textSecondary : TASK_TITLE_COLOR, marginLeft: 10, flex: 1 },
                            task.completed && { textDecorationLine: 'line-through' as const },
                          ]} numberOfLines={2}>
                            {task.title}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handlePromoteTask(phase.id, task.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ paddingLeft: 8 }}
                        >
                          <Ionicons
                            name={isLinked ? 'calendar' : 'calendar-outline'}
                            size={18}
                            color={isLinked ? currentProject.color : theme.textSecondary + '80'}
                          />
                        </TouchableOpacity>
                      </View>
                    )
                  })}

                  <TouchableOpacity
                    style={[styles.addTaskBtn, { borderColor: theme.border }]}
                    onPress={() => { setShowAddTask(phase.id); setTaskTitle('') }}
                  >
                    <Ionicons name="add" size={16} color={theme.primary} />
                    <Text style={[typography.caption, { color: theme.primary, marginLeft: 4 }]}>添加任务</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            )
          })}

          {currentProject.phases.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="layers-outline" size={48} color={theme.textSecondary} />
              <Text style={[typography.body, { color: theme.textSecondary, marginTop: 12 }]}>还没有阶段</Text>
              <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>点击下方按钮添加第一个阶段</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: currentProject.color, bottom: tabBarHeight + 24 }]}
          onPress={() => { setShowAddPhase(true); setPhaseTitle(''); setPhaseDesc('') }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        <BottomSheet visible={showAddPhase} onClose={() => setShowAddPhase(false)} theme={theme} title="添加阶段">
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text }]}
            placeholder="阶段名称"
            placeholderTextColor={theme.textSecondary}
            value={phaseTitle}
            onChangeText={setPhaseTitle}
            autoFocus
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text }]}
            placeholder="描述（可选）"
            placeholderTextColor={theme.textSecondary}
            value={phaseDesc}
            onChangeText={setPhaseDesc}
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: currentProject.color, opacity: phaseTitle.trim() ? 1 : 0.5 }]}
            onPress={handleAddPhase}
            disabled={!phaseTitle.trim()}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>添加阶段</Text>
          </TouchableOpacity>
        </BottomSheet>

        <BottomSheet visible={!!showAddTask} onClose={() => setShowAddTask(null)} theme={theme} title="添加任务">
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text }]}
            placeholder="任务名称"
            placeholderTextColor={theme.textSecondary}
            value={taskTitle}
            onChangeText={setTaskTitle}
            onSubmitEditing={() => showAddTask && handleAddTask(showAddTask)}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: currentProject.color, opacity: taskTitle.trim() ? 1 : 0.5 }]}
            onPress={() => showAddTask && handleAddTask(showAddTask)}
            disabled={!taskTitle.trim()}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>添加任务</Text>
          </TouchableOpacity>
        </BottomSheet>
      </View>
    )
  }

  // ===================== PROJECT LIST VIEW =====================
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.heading1, { color: theme.text }]}>项目</Text>
          <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
            管理你的长期目标
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {projects.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="还没有项目"
          subtitle="创建一个项目来管理复杂的任务"
          theme={theme}
          actionLabel="创建项目"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
          {/* Stats bar */}
          <View style={styles.statsRow}>
            {[
              { label: '进行中', value: stats.active, color: theme.primary },
              { label: '已完成', value: stats.done, color: theme.success },
              { label: '共计', value: stats.total, color: theme.textSecondary },
            ].map(item => (
              <View key={item.label} style={[styles.statCard, { backgroundColor: item.color + '0D' }]}>
                <Text style={[typography.heading3, { color: item.color }]}>{item.value}</Text>
                <Text style={[typography.small, { color: item.color, marginTop: 2 }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Project cards */}
          {sortedProjects.map(project => {
            const progress = getProjectProgress(project)
            const { total, completed } = getProjectTaskCounts(project)
            const isDone = progress === 100

            return (
              <TouchableOpacity
                key={project.id}
                activeOpacity={0.7}
                onPress={() => setSelectedProject(project)}
                onLongPress={() => {
                  impactLight()
                  handleDeleteProject(project)
                }}
                style={{ opacity: isDone ? 0.6 : 1, marginBottom: 12 }}
              >
                <View style={[styles.projectCard, {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  ...theme.cardShadow,
                }]}>
                  <View style={styles.projectCardContent}>
                    <View style={[styles.projectIcon, { backgroundColor: project.color + '15' }]}>
                      <Text style={{ fontSize: 26 }}>{project.icon}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[typography.bodyMedium, { color: theme.text }]}>{project.title}</Text>
                      {project.description ? (
                        <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                          {project.description}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                        <StatusBadge
                          status={isDone ? 'completed' : progress > 0 ? 'in_progress' : 'pending'}
                          color={isDone ? theme.success : progress > 0 ? project.color : theme.textSecondary}
                        />
                        <Text style={[typography.small, { color: theme.textSecondary }]}>
                          {completed}/{total} 任务
                        </Text>
                      </View>
                    </View>

                    <CircularProgress
                      size={44}
                      progress={progress}
                      color={project.color}
                      trackColor={theme.surfaceSecondary}
                      textSize={12}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Create Project Modal */}
      <BottomSheet visible={showCreateModal} onClose={resetCreateForm} theme={theme} title="创建项目">
          <Text style={[typography.label, { color: theme.text, marginBottom: 10 }]}>选择图标</Text>
          <View style={styles.iconGrid}>
            {projectIcons.map(icon => {
              const selected = newIcon === icon
              return (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: selected ? newColor + '18' : theme.surfaceSecondary },
                    selected && { borderColor: newColor, borderWidth: 2, transform: [{ scale: 1.1 }] },
                  ]}
                  onPress={() => setNewIcon(icon)}
                >
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[typography.label, { color: theme.text, marginTop: 18, marginBottom: 10 }]}>选择颜色</Text>
          <View style={styles.colorRow}>
            {projectColors.map(c => {
              const selected = newColor === c.color
              return (
                <TouchableOpacity key={c.id} onPress={() => setNewColor(c.color)}>
                  <View style={[
                    styles.colorOuter,
                    { borderColor: selected ? c.color : 'transparent' },
                  ]}>
                    <View style={[styles.colorInner, { backgroundColor: c.color }]}>
                      {selected && <Ionicons name="checkmark" size={14} color="white" />}
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text, marginTop: 18 }]}
            placeholder="项目名称"
            placeholderTextColor={theme.textSecondary}
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text }]}
            placeholder="项目描述（可选）"
            placeholderTextColor={theme.textSecondary}
            value={newDesc}
            onChangeText={setNewDesc}
            multiline
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: newColor, flex: 1, opacity: newTitle.trim() ? 1 : 0.5 }]}
              onPress={handleCreateProject}
              disabled={!newTitle.trim()}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>创建项目</Text>
            </TouchableOpacity>
            {aiAvailable && (
              <TouchableOpacity
                style={[styles.aiBtn, {
                  borderColor: theme.primary,
                  flex: 1,
                  opacity: newTitle.trim() ? 1 : 0.5,
                }]}
                onPress={handleAIGeneratePlan}
                disabled={!newTitle.trim() || aiPlanLoading}
              >
                {aiPlanLoading ? (
                  <ActivityIndicator size={14} color={theme.primary} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color={theme.primary} />
                    <Text style={[styles.submitBtnText, { color: theme.primary }]}>AI 规划</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },

  // Project card
  projectCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  projectCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  projectIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Detail header
  detailHeader: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  detailHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingLeft: 52,
  },

  // Timeline
  timelineRow: {
    flexDirection: 'row',
    paddingRight: 20,
  },
  timelineLeft: {
    width: 44,
    alignItems: 'center',
    paddingTop: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: -1,
  },

  // Phase card
  phaseCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  phaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  thinProgressBg: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  thinProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  addTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  // Create modal
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default ProjectsScreen
