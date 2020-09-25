import React, { Component } from 'react';
import { connect } from 'react-redux';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { Boardbar } from '../cmps/Boardbar';
import { BoardHeader } from '../cmps/BoardHeader';
import { Navbar } from '../cmps/Navbar';
import { Group } from '../cmps/Group';
import { Popup } from '../cmps/Popup'
import { showSnackbar, hideSnackbar } from '../store/actions/systemActions.js';
import moment from 'moment';
import { userService } from '../services/userService.js';

// Reducers funcs
import { loadUsers } from '../store/actions/userActions'
import {
    updateBoard, loadBoards,   //BOARD
    addGroup, editGroup, removeGroup, //GROUP
    addTask, removeTask, editTask,  //TASK
    clearFilter //FILTER
}
    from '../store/actions/boardActions'
import { groupChanges } from '../store/actions/changesActions'
import { MobileNav } from '../cmps/MobileNav';


class _Board extends Component {

    state = {
        boardId: '',
        txt: ''
    }


    async componentDidMount() {
        try {
            if (!this.props.boards || !this.props.boards.length) {
                await this.props.loadBoards();
                try {
                    if (!this.props.users || !this.props.users.length) {
                        await this.props.loadUsers();
                    }
                } catch (err) {
                    console.log('Error', err)
                }
            }
        } catch (err) {
            console.log('Error', err)
        }
        this.setState({ boardId: this.props.match.params.id })
    }
    displayPopup(msg) {
        console.log('showing popup:', msg);
        this.props.showSnackbar(msg)
        setTimeout(this.props.hideSnackbar, 3000)
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.match.params.id !== this.props.match.params.id) {
            this.props.clearFilter();
            this.setState({ boardId: this.props.match.params.id })
        }
    }

    onEditBoard = async (boardName, boardDescription, toUpdateChanges = false, type, members, activityLog) => {
        const currBoard = this._getCurrBoard()
        const { loggedUser } = this.props;

        const newBoard = {
            ...currBoard,
            name: boardName,
            desc: boardDescription,
            members: members ? members : currBoard.members,
            activityLog: activityLog ? activityLog : currBoard.activityLog
        }

        let desc = ''

        if (toUpdateChanges) {
            switch (type) {
                case 'changeBoardTitle':
                    desc = `${loggedUser.fullName} Changed the board title from ${currBoard.name} to ${boardName}`
                    break;
                case 'changeBoardDesc':
                    desc = `${loggedUser.fullName} Changed ${currBoard.name} description to ${boardDescription}`
                    break;
                case 'addMemberToBoard':
                    desc = `${loggedUser.fullName} Invited a member to the board `
                    break;
                case 'removeMemberFromBoard':
                    desc = `${loggedUser.fullName} Removed a member from the board`
                    break;
            }
        }
        this.props.updateBoard(newBoard, desc, loggedUser)
        this.displayPopup('Updated board.')

    }

    applyFilter = (board, filterBy) => {


        const filteredBoard = JSON.parse(JSON.stringify(board))
        if (filterBy.groupId) {
            filteredBoard.groups = filteredBoard.groups.filter(group => group.id === filterBy.groupId)
        }
        function filterTasks(cb) {
            filteredBoard.groups = filteredBoard.groups.map(group => {
                group.tasks = group.tasks.filter(cb)
                return group;
            })
        }
        if (filterBy.memberId) {
            filterTasks(task => task.members.some(member => member._id === filterBy.memberId))
        }
        if (filterBy.taskPriority) {
            filterTasks(task => task.priority.toLowerCase() === filterBy.taskPriority.toLowerCase())
        }
        if (filterBy.taskStatus) {
            filterTasks(task => task.status.toLowerCase() === filterBy.taskStatus.toLowerCase())
        }
        if (filterBy.dueDate) {
            filterTasks(task => task.dueDate === filterBy.dueDate)
        }
        if (this.state.txt) {
            filterTasks(task => {
                return (
                    task.name.toLowerCase().includes(this.state.txt.toLowerCase())
                    ||
                    task.tags.some(tag => tag.txt.toLowerCase().includes(this.state.txt.toLowerCase()))
                )

            })
        }
        return filteredBoard
    }

    //------------------GROUP CRUD-----------------
    onAddGroup = async () => {
        const board = this._getCurrBoard()
        try {
            this.props.addGroup(board, this.props.loggedUser);
            this.props.clearFilter();
            this.displayPopup('Added group.')

        } catch (err) {
            console.log('Error', err)
        }
        this.props.history.push(`/board/${this.state.boardId}`)
    }
    onRemoveGroup = async (groupId) => {
        const board = this._getCurrBoard()
        try {
            this.props.removeGroup(groupId, board, this.props.loggedUser)
            this.displayPopup('Removed group.')

        } catch (err) {
            console.log('Error', err)
        }
    }
    onEditGroup = async (groupId, changedValue, key) => {
        const { loggedUser } = this.props;
        const board = this._getCurrBoard()
        const group = board.groups.find(group => group.id === groupId)
        if (group[key] === changedValue) return;
        const originalValue = group[key];
        group[key] = changedValue;
        try {
            const desc = `${group.name}: ${loggedUser.fullName} Changed ${originalValue} title to ${changedValue}`;
            this.props.editGroup(group, board, desc, loggedUser)
            this.displayPopup('Updated group.')

        } catch (err) {
            console.log('Error', err)
        }
    }


    //-----------------TASKS CRUD------------------------
    onRemoveTask = async (taskId, group) => {
        const board = this._getCurrBoard()
        try {

            this.props.removeTask(taskId, board, group, this.props.loggedUser)
            this.displayPopup('Removed task.')

        } catch (err) {
            console.log('Error', err)
        }
    }
    onAddTask = async (groupId, taskName) => {
        if (!taskName) taskName = 'New task'

        const { loggedUser } = this.props;
        const board = this._getCurrBoard()
        const notif = `${loggedUser.fullName} Added a task to board ${board.name}`;
        try {
            this.props.addTask(groupId, taskName, board, loggedUser)
            userService.notifyUsers(notif, board.members, loggedUser)
            userService.notifyUsers()
            this.props.clearFilter()
            this.displayPopup('Added task.')

        } catch (err) {
            console.log('Error', err)
        }
    }



    onEditTask = async (task, group, changedValue = true, originalValue = false, type) => {
        const board = this._getCurrBoard()
        const { loggedUser } = this.props;
        if (changedValue === originalValue) return
        let desc = '';
        switch (type) {
            case 'name':
                desc = `${loggedUser.fullName} changed task name from ${originalValue} to ${changedValue} at group - ${group.name}`
                break;
            case 'sendNote':
                desc = `${loggedUser.fullName} sent an update at task: ${task.name} at group - ${group.name}`
                break;
            case 'status':
                desc = `${loggedUser.fullName} changed task: ${task.name} status from ${originalValue} to ${changedValue} at group - ${group.name}`
                break;
            case 'priority':
                desc = `${loggedUser.fullName} changed task: ${task.name} priority from ${originalValue} to ${changedValue} at group - ${group.name}`
                break;
            case 'date':
                desc = `${loggedUser.fullName} changed task ${task.name} date from ${moment(originalValue).format('DD/MMM/YYYY')} to ${moment(changedValue).format('DD/MMM/YYYY')} at group - ${group.name}`

                break;
            case 'removeFromTask':
                desc = `${loggedUser.fullName} removed ${changedValue.fullName} from ${task.name} at group - ${group.name}`

                break;
            case 'addToTask':
                desc = `${loggedUser.fullName} tasked ${changedValue.fullName} to ${task.name} on group - ${group.name}`

                break;
            case 'addTag':
                desc = `${loggedUser.fullName} added tag named ${changedValue} to ${task.name} on group - ${group.name}`
                break;
            case 'removeTag':
                desc = `${loggedUser.fullName} removed tag named ${changedValue} from ${task.name} on group - ${group.name}`
                break;

            default:
                break;
        }
        this.props.editTask(task, board, desc, loggedUser)
        this.displayPopup('Updated task.')


    }
    //---------------------Draggable----------------------

    onDragEnd = async result => {
        const { destination, source, draggableId, type } = result
        if (!destination) return;
        if (destination.droppableId === source.droppableId
            &&
            destination.index === source.index) return;

        const board = this._getCurrBoard()

        if (type === 'group') {
            const newGroups = Array.from(board.groups)
            const draggedGroup = newGroups.find(group => group.id === draggableId)
            newGroups.splice(source.index, 1)
            newGroups.splice(destination.index, 0, draggedGroup)
            board.groups = newGroups
            try {
                this.props.updateBoard(board)

            } catch (err) {
                console.log('Error', err);
            }
        } else {
            const groupStart = board.groups.find(group => group.id === source.droppableId)
            const groupEnd = board.groups.find(group => group.id === destination.droppableId)

            if (groupStart.id === groupEnd.id) {

                const newTasks = Array.from(groupStart.tasks)
                const newTask = groupStart.tasks.find(task => task.id === draggableId)

                newTasks.splice(source.index, 1)
                newTasks.splice(destination.index, 0, newTask)

                const newGroup = {
                    ...groupStart,
                    tasks: newTasks
                }
                const newIdx = board.groups.findIndex(group => group.id === newGroup.id)
                board.groups.splice(newIdx, 1, newGroup)
                try {
                    this.props.updateBoard(board)


                } catch (err) {
                    console.log('Error', err);
                }
            } else {

                const startTasks = Array.from(groupStart.tasks)
                startTasks.splice(source.index, 1)
                const newStartGroup = {
                    ...groupStart,
                    tasks: startTasks
                }
                const endTasks = Array.from(groupEnd.tasks)
                const newTaskToPaste = groupStart.tasks.find(task => task.id === draggableId)
                endTasks.splice(destination.index, 0, newTaskToPaste)
                const newFinishGroup = {
                    ...groupEnd,
                    tasks: endTasks
                }

                const startIdx = board.groups.findIndex(group => group.id === newStartGroup.id)
                const endIdx = board.groups.findIndex(group => group.id === newFinishGroup.id)

                board.groups.splice(startIdx, 1, newStartGroup)
                board.groups.splice(endIdx, 1, newFinishGroup)
                try {
                    const { loggedUser } = this.props;
                    const desc = `${loggedUser.fullName} Moved ${newTaskToPaste.name} from ${newStartGroup.name} to ${newFinishGroup.name}`
                    this.props.updateBoard(this._getCurrBoard(), desc, loggedUser)

                } catch (err) {
                    console.log('Error', err);
                }
            }
        }
    }

    handleSearch = (ev) => {
        this.setState({ txt: ev.target.value })
    }
    handleBoardBarSearch = (val) => {
        this.setState({ boardBarSearch: val })
    }

    _getCurrBoard = () => {
        return this.props.boards.find(board => board._id === this.state.boardId)
    }

    render() {
        if (this.props.boards.length === 0) return <h1>Loading...</h1>
        const board = this._getCurrBoard()
        const { users, filterBy } = this.props;
        if (!board) return <h1>Loading..</h1>
        const filteredBoard = this.applyFilter(board, filterBy);
        return (
            <section className={`board ${window.innerWidth > 450 ? 'flex' : 'flex column'}`}>
                {window.innerWidth > 450 ?
                    <React.Fragment>
                        <Navbar />
                        <Boardbar handleBoardBarSearch={this.handleBoardBarSearch} />
                    </React.Fragment>
                    :
                    <MobileNav loggedUser={this.props.loggedUser} />
                }
                <div className="board-container">
                    {window.innerWidth > 450 && <BoardHeader board={board} onAddGroup={this.onAddGroup} onEditBoard={this.onEditBoard}
                        handleSearch={this.handleSearch} users={users} />}
                    <div className="groups-container padding-x-30" style={{ height: `${window.innerWidth < 450 && 95 + 'vh'}` }}>
                        <DragDropContext
                            onDragEnd={this.onDragEnd}
                        >
                            <Droppable droppableId={board._id} type="group">
                                {(provided, snapshot) =>
                                    <div className={`group-list`}
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}>
                                        {filteredBoard.groups.map((group, index) => {
                                            return <Group key={group.id} index={index}
                                                onEditTask={this.onEditTask} onAddTask={this.onAddTask} onRemoveTask={this.onRemoveTask}
                                                onRemoveGroup={this.onRemoveGroup} onEditGroup={this.onEditGroup}
                                                onChangeGroupColor={this.onChangeGroupColor} group={group} users={board.members} />
                                        })}
                                    </div>
                                }
                            </Droppable>
                        </DragDropContext>
                    </div>
                </div>
                <Popup />
            </section>
        )
    }
}



const mapStateToProps = state => {
    return {
        boards: state.boardReducer.boards,
        users: state.userReducer.users,
        loggedUser: state.userReducer.loggedUser,
        filterBy: state.boardReducer.filterBy
    }
}

const mapDispatchToProps = {
    loadBoards,
    addGroup,
    removeGroup,
    addTask,
    removeTask,
    editTask,
    editGroup,
    updateBoard,
    showSnackbar,
    hideSnackbar,
    loadUsers,
    clearFilter,
    groupChanges
}

export const Board = connect(mapStateToProps, mapDispatchToProps)(_Board);