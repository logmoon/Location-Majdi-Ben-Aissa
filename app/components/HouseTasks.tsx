import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { sortPendingTasks } from '../../lib/taskLogic';
import { useRental } from '../context/RentalContext';
import { useTask } from '../context/TaskContext';
import { HouseTask, TaskCategory } from '../services/taskService';

interface HouseTasksProps {
  houseId: number;
}

// ─── Category config ────────────────────────────────────────────────────────

const CATEGORIES: { value: TaskCategory; label: string; icon: string; color: string }[] = [
  { value: 'cleaning',    label: 'Nettoyage',    icon: 'sparkles-outline',      color: '#3498db' },
  { value: 'purchase',   label: 'Achat',         icon: 'cart-outline',          color: '#27ae60' },
  { value: 'repair',     label: 'Réparation',    icon: 'construct-outline',     color: '#e67e22' },
  { value: 'replacement',label: 'Remplacement',  icon: 'swap-horizontal-outline', color: '#9b59b6' },
];

const getCategoryConfig = (cat: TaskCategory) =>
  CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[0];

// ─── Add / Edit Task Modal ───────────────────────────────────────────────────

interface TaskFormModalProps {
  visible: boolean;
  houseId: number;
  editingTask?: HouseTask | null;
  onClose: () => void;
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({ visible, houseId, editingTask, onClose }) => {
  const { addTask, updateTask } = useTask();

  const [category, setCategory] = useState<TaskCategory>(editingTask?.category ?? 'cleaning');
  const [description, setDescription] = useState(editingTask?.description ?? '');
  const [isUrgent, setIsUrgent] = useState(editingTask?.isUrgent ?? false);

  // Reset form when modal opens with new data
  React.useEffect(() => {
    if (visible) {
      setCategory(editingTask?.category ?? 'cleaning');
      setDescription(editingTask?.description ?? '');
      setIsUrgent(editingTask?.isUrgent ?? false);
    }
  }, [visible, editingTask]);

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Erreur', 'La description est requise.');
      return;
    }

    if (editingTask?.id) {
      await updateTask(editingTask.id, { category, description: description.trim(), isUrgent });
    } else {
      await addTask({
        houseId,
        category,
        description: description.trim(),
        isUrgent,
        isDone: false,
        rentalPeriodId: null,
      });
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>
            {editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </Text>

          {/* Category picker */}
          <Text style={modalStyles.label}>Catégorie</Text>
          <View style={modalStyles.categoryRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  modalStyles.categoryPill,
                  category === cat.value && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={category === cat.value ? 'white' : cat.color}
                />
                <Text style={[
                  modalStyles.categoryPillText,
                  category === cat.value && { color: 'white' },
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={modalStyles.label}>Description</Text>
          <TextInput
            style={modalStyles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Ex: Remplacer la bonbonne de gaz..."
            multiline
            numberOfLines={3}
          />

          {/* Urgent toggle */}
          <View style={modalStyles.urgentRow}>
            <Text style={modalStyles.label}>Urgent</Text>
            <Switch
              value={isUrgent}
              onValueChange={setIsUrgent}
              trackColor={{ false: '#ccc', true: '#e74c3c' }}
              thumbColor={isUrgent ? '#c0392b' : '#f4f3f4'}
            />
          </View>

          {/* Buttons */}
          <View style={modalStyles.buttonRow}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.saveBtn} onPress={handleSave}>
              <Text style={modalStyles.saveBtnText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Task Row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: HouseTask;
  onEdit: (task: HouseTask) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, onEdit }) => {
  const { toggleTaskDone, deleteTask } = useTask();
  const cat = getCategoryConfig(task.category);

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la tâche',
      'Êtes-vous sûr de vouloir supprimer cette tâche ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => task.id && deleteTask(task.id),
        },
      ]
    );
  };

  return (
    <View style={[rowStyles.container, task.isDone && rowStyles.doneContainer]}>
      {/* Category color bar */}
      <View style={[rowStyles.colorBar, { backgroundColor: cat.color }]} />

      {/* Checkbox */}
      <TouchableOpacity style={rowStyles.checkbox} onPress={() => toggleTaskDone(task)}>
        <Ionicons
          name={task.isDone ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={task.isDone ? '#27ae60' : '#ccc'}
        />
      </TouchableOpacity>

      {/* Content */}
      <View style={rowStyles.content}>
        <View style={rowStyles.topRow}>
          <View style={[rowStyles.categoryBadge, { backgroundColor: cat.color + '20' }]}>
            <Ionicons name={cat.icon as any} size={12} color={cat.color} />
            <Text style={[rowStyles.categoryText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          {task.isUrgent && !task.isDone && (
            <View style={rowStyles.urgentBadge}>
              <Text style={rowStyles.urgentText}>Urgent</Text>
            </View>
          )}
        </View>
        <Text style={[rowStyles.description, task.isDone && rowStyles.doneText]} numberOfLines={2}>
          {task.description}
        </Text>
        {task.createdAt && (
          <Text style={rowStyles.date}>
            {new Date(task.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        )}
      </View>

      {/* Actions */}
      {!task.isDone && (
        <TouchableOpacity style={rowStyles.editBtn} onPress={() => onEdit(task)}>
          <Ionicons name="pencil-outline" size={16} color="#666" />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={rowStyles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={16} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  );
};

// ─── Main HouseTasks Component ───────────────────────────────────────────────

const HouseTasks: React.FC<HouseTasksProps> = ({ houseId }) => {
  const { getTasksForHouse, getPendingTasksForHouse } = useTask();
  const { isAdmin } = useRental();
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<HouseTask | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Tasks are visible to admins only
  if (!isAdmin) return null;

  const allTasks = getTasksForHouse(houseId);
  const pendingTasks = getPendingTasksForHouse(houseId);
  const doneTasks = allTasks.filter(t => t.isDone);

  // Sort: urgent first, then by date — via shared pure helper
  const sortedPending = sortPendingTasks(pendingTasks);

  const handleEdit = (task: HouseTask) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="clipboard-outline" size={20} color="#333" />
          <Text style={styles.headerTitle}>Tâches</Text>
          {pendingTasks.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingTasks.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => { setEditingTask(null); setShowModal(true); }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Pending tasks */}
      {sortedPending.length === 0 && doneTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={36} color="#ccc" />
          <Text style={styles.emptyText}>Aucune tâche en cours</Text>
        </View>
      ) : (
        <>
          {sortedPending.map(task => (
            <TaskRow key={task.id ?? task.tempId} task={task} onEdit={handleEdit} />
          ))}

          {/* Done tasks toggle */}
          {doneTasks.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.doneToggle}
                onPress={() => setShowDone(v => !v)}
              >
                <Ionicons
                  name={showDone ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color="#999"
                />
                <Text style={styles.doneToggleText}>
                  {showDone ? 'Masquer' : `Voir`} {doneTasks.length} tâche{doneTasks.length > 1 ? 's' : ''} terminée{doneTasks.length > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>

              {showDone && doneTasks.map(task => (
                <TaskRow key={task.id ?? task.tempId} task={task} onEdit={handleEdit} />
              ))}
            </>
          )}
        </>
      )}

      <TaskFormModal
        visible={showModal}
        houseId={houseId}
        editingTask={editingTask}
        onClose={handleCloseModal}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
  },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 4,
  },
  doneToggleText: {
    color: '#999',
    fontSize: 13,
  },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  doneContainer: {
    opacity: 0.55,
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  checkbox: {
    padding: 10,
  },
  content: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 4,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  urgentBadge: {
    backgroundColor: '#fdecea',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  urgentText: {
    color: '#e74c3c',
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 19,
  },
  doneText: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  date: {
    fontSize: 11,
    color: '#bbb',
  },
  editBtn: {
    padding: 10,
  },
  deleteBtn: {
    padding: 10,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  urgentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#3498db',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});

export default HouseTasks;
