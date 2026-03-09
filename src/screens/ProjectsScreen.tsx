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
import { crossAlert } from '../lib/alert'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'
import { typography } from '../theme/typography'
import { Project, ProjectPhase } from '../types'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import { isAIConfigured, generateProjectPlan } from '../services/ai'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

const projectColors = [
  { id: 'blue', color: '#3B82F6' },
  { id: 'green', color: '#10B981' },
  { id: 'purple', color: '#8B5CF6' },
  { id: 'orange', color: '#F97316' },
  { id: 'pink', color: '#EC4899' },
  { id: 'cyan', color: '#06B6D4' },
]

const projectIcons = ['📱', '🎮', '📚', '💻', '🎨', '🎵', '💪', '✈️', '🏠', '💼', '🧪', '🌱']

const getProjectProgress = (project: Project) => {
  if (project.phases.length === 0) return 0
  const totalTasks = project.phases.reduce((sum, p) => sum + p.tasks.length, 0)
  const completedTasks = project.phases.reduce((sum, p) => sum + p.tasks.filter(t => t.completed).length, 0)
  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
}


const getPhaseProgress = (phase: ProjectPhase) => {
  if (phase.tasks.length === 0) return phase.status === 'completed' ? 100 : 0
  const completed = phase.tasks.filter(t => t.completed).length
  return Math.round((completed / phase.tasks.length) * 100)
}

const ProjectsScreen = () => {
  const {
    projects, themeColor, darkMode,
    addProject, updateProject, deleteProject,
    addProjectPhase, updateProjectPhase, deleteProjectPhase,
    toggleProjectTask,
  } = useStore()
  const theme = getTheme(themeColor, darkMode)
  const tabBarHeight = useBottomTabBarHeight()

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
      setNewTitle('')
      setNewDesc('')
      setNewIcon('📱')
      setNewColor('#3B82F6')
      setShowCreateModal(false)
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
    setNewTitle('')
    setNewDesc('')
    setNewIcon('📱')
    setNewColor('#3B82F6')
    setShowCreateModal(false)
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

  // Project detail view
  if (currentProject) {
    const progress = getProjectProgress(currentProject)
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
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
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={[typography.label, { color: theme.text }]}>进度</Text>
            <Text style={[typography.label, { color: currentProject.color }]}>{progress}%</Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceSecondary }]}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: currentProject.color }]} />
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
          {currentProject.phases.map((phase) => {
            const pProgress = getPhaseProgress(phase)
            return (
              <Card key={phase.id} theme={theme} style={{ marginBottom: 12 }}>
                <View style={styles.phaseHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.phaseTitle}>
                      <View style={[styles.phaseDot, { backgroundColor: currentProject.color }]} />
                      <Text style={[typography.bodyMedium, { color: theme.text, flex: 1 }]}>{phase.title}</Text>
                      <Text style={[typography.caption, { color: theme.textSecondary }]}>
                        {pProgress}%
                      </Text>
                    </View>
                    {phase.description ? (
                      <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4, marginLeft: 16 }]}>
                        {phase.description}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => handleDeletePhase(phase.id)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={theme.error} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.phaseProgressBg, { backgroundColor: theme.surfaceSecondary, marginTop: 8 }]}>
                  <View style={[styles.phaseProgressFill, { width: `${pProgress}%`, backgroundColor: currentProject.color + '80' }]} />
                </View>

                {phase.tasks.map(task => (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.taskRow}
                    onPress={() => toggleProjectTask(currentProject.id, phase.id, task.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={task.completed ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={task.completed ? theme.success : theme.textSecondary}
                    />
                    <Text style={[
                      typography.body,
                      { color: task.completed ? theme.textSecondary : theme.text, marginLeft: 10, flex: 1 },
                      task.completed && { textDecorationLine: 'line-through' },
                    ]}>
                      {task.title}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[styles.addTaskBtn, { borderColor: theme.border }]}
                  onPress={() => { setShowAddTask(phase.id); setTaskTitle('') }}
                >
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={[typography.caption, { color: theme.primary, marginLeft: 4 }]}>添加任务</Text>
                </TouchableOpacity>
              </Card>
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
          style={[styles.fab, { backgroundColor: currentProject.color, bottom: tabBarHeight + 16 }]}
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

  // Project list view
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.heading1, { color: theme.text }]}>项目</Text>
          <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
            {projects.length} 个项目
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
          {projects.map(project => {
            const progress = getProjectProgress(project)
            const totalTasks = project.phases.reduce((s, p) => s + p.tasks.length, 0)
            const completedTasks = project.phases.reduce((s, p) => s + p.tasks.filter(t => t.completed).length, 0)

            return (
              <TouchableOpacity
                key={project.id}
                activeOpacity={0.7}
                onPress={() => setSelectedProject(project)}
              >
                <Card theme={theme}>
                  <View style={styles.projectCardHeader}>
                    <View style={[styles.projectIcon, { backgroundColor: project.color + '18' }]}>
                      <Text style={{ fontSize: 24 }}>{project.icon}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[typography.bodyMedium, { color: theme.text }]}>{project.title}</Text>
                      <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 3 }]}>
                        {project.phases.length} 个阶段 · {completedTasks}/{totalTasks} 任务完成
                      </Text>
                    </View>
                    <Text style={[typography.label, { color: project.color, fontSize: 15, marginRight: 8 }]}>{progress}%</Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteProject(project)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceSecondary, marginTop: 14 }]}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: project.color }]} />
                  </View>
                </Card>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      <BottomSheet visible={showCreateModal} onClose={() => {
        setShowCreateModal(false)
        setNewTitle('')
        setNewDesc('')
        setNewIcon('📱')
        setNewColor('#3B82F6')
      }} theme={theme} title="创建项目">
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
          <Text style={[typography.label, { color: theme.text, marginBottom: 8 }]}>图标</Text>
          <View style={styles.iconGrid}>
            {projectIcons.map(icon => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconBtn,
                  { backgroundColor: newIcon === icon ? newColor + '18' : theme.surfaceSecondary },
                  newIcon === icon && { borderColor: newColor, borderWidth: 2 },
                ]}
                onPress={() => setNewIcon(icon)}
              >
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[typography.label, { color: theme.text, marginTop: 16, marginBottom: 8 }]}>颜色</Text>
          <View style={styles.colorRow}>
            {projectColors.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.colorBtn,
                  { backgroundColor: c.color },
                  newColor === c.color && { borderWidth: 3, borderColor: theme.text },
                ]}
                onPress={() => setNewColor(c.color)}
              >
                {newColor === c.color && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text, marginTop: 16 }]}
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
                style={[styles.submitBtn, { backgroundColor: theme.primary, flex: 1, opacity: newTitle.trim() ? 1 : 0.5 }]}
                onPress={handleAIGeneratePlan}
                disabled={!newTitle.trim() || aiPlanLoading}
              >
                {aiPlanLoading ? (
                  <ActivityIndicator size={14} color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>AI 规划</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
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
  projectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  phaseTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseProgressBg: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  phaseProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 16,
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
  colorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default ProjectsScreen
