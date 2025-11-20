
// Model: 데이터와 비즈니스 로직 관리 (LocalStorage)
// View: DOM 요소 선택 및 UI 렌더링
// Controller: Model과 View를 연결하고 이벤트 처리

//객체 지향적 아키텍처 MVC


const qs = (selector, scope = document) => scope.querySelector(selector); //querySelector 언제까지 칠 수 없음
const on = (target, type, callback, capture = false) => {                 //addEventListener 언제까지 칠 수 없음
  target.addEventListener(type, callback, capture);                       //유지보수 쉬워짐
};

// XSS 방지용 이스케이프  (Cross Site Scripting)
const escapeHtml = (string) => {
  return String(string)
    .replace(/&/g, '&amp;')  // &
    .replace(/</g, '&lt;')   // < (태그 시작)
    .replace(/>/g, '&gt;')   // > (태그 끝)
    .replace(/"/g, '&quot;') // " (속성값)
    .replace(/'/g, '&#039;'); // ' (작은따옴표
};


// Model (데이터 관리)

class TodoModel {
  constructor(key) {
    this.storageKey = key;
    this.todos = JSON.parse(localStorage.getItem(key)) || [];
  }

  // 할 일 반환
  getTodos() {
    return this.todos;
  }

  // 변경사항 저장 및 Controller에게 알림 어쩌피 저장은 해야하니까 여기에 몰아서 저장 (단) observer 패턴 아니여서 "일일이" 보고하는 방식임 
  _commit(todos) {
    this.todos = todos;
    localStorage.setItem(this.storageKey, JSON.stringify(todos));
  }

  addTodo(title) {
    const newTodo = {
      id: Date.now(),
      title: title,
      completed: false,
    };
    this._commit([...this.todos, newTodo]);
  }

  editTodo(id, updatedTitle) {
    this._commit(
      this.todos.map((todo) =>
        todo.id === id ? { ...todo, title: updatedTitle } : todo
      )
    );
  }

  deleteTodo(id) {
    this._commit(this.todos.filter((todo) => todo.id !== id));
  }

  toggleTodo(id) {
    this._commit(
      this.todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }

  toggleAll(isCompleted) {
    this._commit(
      this.todos.map((todo) => ({ ...todo, completed: isCompleted }))
    );
  }

  clearCompleted() {
    this._commit(this.todos.filter((todo) => !todo.completed));
  }
}

// View (화면 렌더링)

class TodoView {
  constructor() {
    // 변수명 확실하게 (가독성 살리기)
    this.todoListElement = qs('.todo-list');
    this.newTodoInput = qs('.new-todo');
    this.mainElement = qs('.main');
    this.footerElement = qs('.footer');
    this.toggleAllCheckbox = qs('.toggle-all');
    this.todoCountElement = qs('.todo-count');
    this.clearCompletedButton = qs('.clear-completed');
    this.filtersContainer = qs('.filters');
  }


  _createTodoItemHtml(todo) { //innerHtml 길게 쓰기 귀찮음용 손질 코드 (하지만 성능 유지보수 측면에서도 이득)
    return `
      <li data-id="${todo.id}" class="${todo.completed ? 'completed' : ''}">
        <div class="view">
          <input class="toggle" type="checkbox" ${todo.completed ? 'checked' : ''}>
          <label>${escapeHtml(todo.title)}</label>
          <button class="destroy"></button>
        </div>
        <input class="edit" value="${escapeHtml(todo.title)}">
      </li>
    `;
  }

//   <li data-id="123" class="completed">
//   <div class="view">
//     <input class="toggle" type="checkbox" checked>
//     <label>점심 먹기</label>
//     <button class="destroy"></button>
//   </div>
//   <input class="edit" value="점심 먹기">
// </li>

  
  // 화면 그리기 (Render)
  
  render(todos, filter) {
    // 필터링
    let filteredTodos = todos;
    if (filter === 'active') filteredTodos = todos.filter(t => !t.completed);
    if (filter === 'completed') filteredTodos = todos.filter(t => t.completed);

    // 리스트 HTML 업데이트            /   map이랑join써서 문자열 n개 하나로 합친뒤 1번만 집어넣기
    this.todoListElement.innerHTML = filteredTodos.map(this._createTodoItemHtml).join(''); //innerHTML 길게 쓰기 귀찮음용 손질 코드 (하지만 성능 유지보수 측면에서도 이득)

    // UI 상태 업데이트 (보이기/숨기기)
    const hasTodos = todos.length > 0;
    this.mainElement.style.display = hasTodos ? 'block' : 'none';
    this.footerElement.style.display = hasTodos ? 'block' : 'none';

    // Toggle All 체크박스 상태
    const activeCount = todos.filter(t => !t.completed).length;
    this.toggleAllCheckbox.checked = activeCount === 0 && hasTodos;

    // Clear Completed 버튼
    const completedCount = todos.length - activeCount;
    this.clearCompletedButton.style.display = completedCount > 0 ? 'block' : 'none';

    // 남은 개수 텍스트
    this.todoCountElement.innerHTML = `
      <strong>${activeCount}</strong> item${activeCount !== 1 ? 's' : ''} left
    `;

    // 필터 버튼 스타일
    const filterLinks = this.filtersContainer.querySelectorAll('a');
    filterLinks.forEach(link => {
      const linkHref = link.getAttribute('href');
      if (linkHref === `#/${filter === 'all' ? '' : filter}`) {
        link.classList.add('selected');
      } else {
        link.classList.remove('selected');
      }
    });
  }
}


// Controller (제어)

class TodoController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.currentFilter = this._getFilterFromHash();

    // 이벤트 바인딩 실행
    this._bindEvents();
    
    // 초기 렌더링
    this._updateView();
  }

  _getFilterFromHash() {
    const hash = window.location.hash.replace('#/', '');
    return (hash === 'active' || hash === 'completed') ? hash : 'all';
  }

  _updateView() {
    const todos = this.model.getTodos();
    this.view.render(todos, this.currentFilter);
  }

  _bindEvents() {
    // 새 할 일 추가
    on(this.view.newTodoInput, 'change', (e) => {
      const title = e.target.value.trim();
      if (title) {
        this.model.addTodo(title);
        e.target.value = '';
        this._updateView();
      }
    });

    // 리스트 클릭 이벤트 (삭제, 토글 - 이벤트 위임)
    on(this.view.todoListElement, 'click', (e) => {
      const target = e.target;
      const li = target.closest('li');
      if (!li) return;
      const id = parseInt(li.dataset.id);

      if (target.classList.contains('destroy')) {
        this.model.deleteTodo(id);
        this._updateView();
      } else if (target.classList.contains('toggle')) {
        this.model.toggleTodo(id);
        this._updateView();
      }
    });

    // 더블 클릭으로 수정 모드 진입
    on(this.view.todoListElement, 'dblclick', (e) => {
      const target = e.target;
      const li = target.closest('li');
      
      if (target.tagName === 'LABEL' && li) {
        li.classList.add('editing');
        const editInput = li.querySelector('.edit');
        // 커서를 끝으로 보내기 위한 행동
        const tmp = editInput.value;
        editInput.value = '';
        editInput.value = tmp;
        editInput.focus();
      }
    });

    // 4. 수정 완료 (Enter)(Esc)
    on(this.view.todoListElement, 'keyup', (e) => {
      if (!e.target.classList.contains('edit')) return;
      
      const li = e.target.closest('li');
      const id = parseInt(li.dataset.id);
      const val = e.target.value.trim();

      if (e.key === 'Enter') {
        e.target.blur(); // focusout 이벤트가 처리함
      } else if (e.key === 'Escape') {
        li.classList.remove('editing');
        this._updateView(); // 원래 값 복구
      }
    });

    // 5. 수정값 저장
    on(this.view.todoListElement, 'focusout', (e) => {
      if (!e.target.classList.contains('edit')) return;
      
      const li = e.target.closest('li');
      if (!li || !li.classList.contains('editing')) return; // 이미 처리되었거나 수정모드가 아니면 무시

      const id = parseInt(li.dataset.id);
      const val = e.target.value.trim();

      if (val) {
        this.model.editTodo(id, val);
      } else {
        this.model.deleteTodo(id);
      }
      this._updateView();
    });

    // 전체 완료 토글
    on(this.view.toggleAllCheckbox, 'click', (e) => {
      this.model.toggleAll(e.target.checked);
      this._updateView();
    });

    // 완료된 항목 삭제
    on(this.view.clearCompletedButton, 'click', () => {
      this.model.clearCompleted();
      this._updateView();
    });

    // 라우팅 (필터 변경) hashchange
    on(window, 'hashchange', () => {
      this.currentFilter = this._getFilterFromHash();
      this._updateView();
    });
  }
}

// 앱 초기화
const model = new TodoModel('todos-vanilla-mvc');
const view = new TodoView();
const app = new TodoController(model, view);