(function(){
  'use strict';

  // ====================================================================
  // CONFIGURATION - مركزية جميع الإعدادات
  // ====================================================================
  const CONFIG = {
    API: {
      CLOUDINARY_CLOUD_NAME: "dis8famig",
      CLOUDINARY_UPLOAD_PRESET: "Upload Preset",
      PROXY_URL: "https://courses-api-proxy.amr-omar304.workers.dev/"
    },
    UI: {
      SEARCH_DEBOUNCE_DELAY: 300,
      AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
      TOAST_DURATION: 5000,
      MAX_DESCRIPTION_LENGTH: 80
    },
    VALIDATION: {
      REQUIRED_FIELDS: ['title', 'category', 'instructor'],
      MIN_PRICE: 0,
      MIN_STUDENTS: 0
    }
  };

  // ====================================================================
  // DATA MANAGEMENT - إدارة البيانات والحالة
  // ====================================================================
  class CourseDataManager {
    constructor() {
      this.courses = [];
      this.filteredCourses = [];
      this.isLoading = false;
      this.isDirty = false;
    }

    // Get all courses
    getAllCourses() {
      return [...this.courses];
    }

    // Get filtered courses
    getFilteredCourses() {
      return [...this.filteredCourses];
    }

    // Set courses data
    setCourses(coursesData) {
      this.courses = coursesData.map(c => ({
        ...c,
        id: c.id !== undefined ? String(c.id) : "",
        _sheetRow: (c._sheetRow !== undefined && c._sheetRow !== null) ? Number(c._sheetRow) : null
      }));
      
      // Stable sort by numeric ID
      this.courses.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
      this.filteredCourses = [...this.courses];
    }

    // Filter courses by search term
    filterCourses(searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      
      if (!term) {
        this.filteredCourses = [...this.courses];
        return this.filteredCourses;
      }

      this.filteredCourses = this.courses.filter(course => {
        const title = (course.title || '').toLowerCase();
        const category = (course.category || '').toLowerCase();
        const instructor = (course.instructor || '').toLowerCase();
        const tags = Array.isArray(course.tags) ? course.tags.join(' ').toLowerCase() : '';
        
        return title.includes(term) || 
               category.includes(term) || 
               instructor.includes(term) || 
               tags.includes(term);
      });

      return this.filteredCourses;
    }

    // Find course by ID
    findCourseById(id) {
      return this.courses.find(c => String(c.id) === String(id));
    }

    // Get courses count
    getCoursesCount() {
      return {
        total: this.courses.length,
        filtered: this.filteredCourses.length
      };
    }

    // Loading state management
    setLoading(isLoading) {
      this.isLoading = isLoading;
    }

    getLoading() {
      return this.isLoading;
    }

    // Dirty state management
    setDirty(isDirty) {
      this.isDirty = isDirty;
    }

    getDirty() {
      return this.isDirty;
    }
  }

  // ====================================================================
  // API SERVICE - طبقة التواصل مع الخادم
  // ====================================================================
  class ApiService {
    constructor(baseUrl) {
      this.baseUrl = baseUrl;
    }

    async request(action, payload = {}) {
      try {
        const options = {
          method: action === 'load' ? 'GET' : 'POST',
          headers: { "Content-Type": "application/json" }
        };

        if (action !== 'load') {
          options.body = JSON.stringify({ action, payload });
        }

        const response = await fetch(this.baseUrl, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        if (!result) {
          throw new Error('Empty response from server');
        }

        if (result.status === 'error') {
          throw new Error(result.message || 'Unknown server error');
        }

        return result;
      } catch (error) {
        console.error("API Communication Error:", error);
        throw new Error(`Connection failed: ${error.message}`);
      }
    }

    async loadCourses() {
      return await this.request('load');
    }

    async addCourse(courseData) {
      return await this.request('add', courseData);
    }

    async updateCourse(id, courseData) {
      return await this.request('update', { id: String(id), data: courseData });
    }

    async deleteCourse(id) {
      return await this.request('delete', { id: String(id) });
    }
  }

  // ====================================================================
  // UI TEMPLATE FACTORY - مصانع بناء الواجهة
  // ====================================================================
  const UITemplates = {
    // Create course card HTML
    createCourseCard(course) {
      if (!course || !course.id) return '';

      const price = (course.price === 0) ? 'Free' : `$${(Number(course.price) || 0).toFixed(2)}`;
      const description = this.escapeHtml(course.description || 'No description');
      const truncatedDesc = description.slice(0, CONFIG.UI.MAX_DESCRIPTION_LENGTH);
      const displayDesc = description.length > CONFIG.UI.MAX_DESCRIPTION_LENGTH ? 
        `${truncatedDesc}…` : truncatedDesc;
      
      const students = course.students || 0;
      const rating = (typeof course.rating === 'number') ? course.rating : (Number(course.rating) || 0);
      const sheetRowAttr = course._sheetRow !== undefined && course._sheetRow !== null ? 
        `data-sheet-row="${course._sheetRow}"` : '';

      return `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card h-100 position-relative" data-course-id="${this.escapeHtml(course.id)}" ${sheetRowAttr}>
            <span class="badge bg-primary position-absolute top-0 start-0 m-2" style="z-index:1">ID: ${this.escapeHtml(course.id)}</span>
            <span class="badge bg-secondary admin-card-badge">${this.escapeHtml(course.category || 'Uncategorized')}</span>
            <div class="card-body d-flex flex-column">
              <h3 class="h6 card-title mt-2">${this.escapeHtml(course.title || 'Untitled Course')}</h3>
              <p class="small text-muted flex-grow-1">${displayDesc}</p>
              <div class="small text-muted mb-2">
                <span class="me-2">👨‍🏫 ${this.escapeHtml(course.instructor || 'TBA')}</span><br>
                <span class="me-2">👥 ${students} students</span>
                <span>⭐ ${rating.toFixed(1)}/5</span>
              </div>
              <div class="mt-auto d-flex justify-content-between align-items-center">
                <strong class="text-warning">${price}</strong>
                <div class="admin-card-controls" role="group">
                  <button type="button" class="btn btn-sm btn-outline-info" data-action="edit" data-course-id="${this.escapeHtml(course.id)}" title="Edit Course">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-course-id="${this.escapeHtml(course.id)}" title="Delete Course">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    },

    // Create empty state HTML
    createEmptyState(hasSearch, searchTerm = '', totalCourses = 0) {
      if (hasSearch) {
        return `
          <div class="col-12 text-center p-4">
            <i class="bi bi-search text-muted mb-2"></i><br>
            <span class="text-muted">No courses match "${this.escapeHtml(searchTerm)}"</span>
          </div>`;
      }

      if (totalCourses === 0) {
        return `
          <div class="col-12 text-center p-5">
            <i class="bi bi-plus-circle display-4 text-muted mb-3"></i>
            <h4 class="text-muted">No courses yet</h4>
            <p class="text-muted">Click "Add Course" to create your first course.</p>
          </div>`;
      }

      return '';
    },

    // Create error state HTML
    createErrorState(errorMessage) {
      return `
        <div class="col-12 text-center text-danger p-4">
          <i class="bi bi-exclamation-triangle mb-2"></i><br>
          <strong>Connection Error</strong><br>
          ${this.escapeHtml(errorMessage)}
        </div>`;
    },

    // Escape HTML to prevent XSS
    escapeHtml(str = '') {
      return String(str).replace(/[&<>"']/g, s => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[s]);
    }
  };

  // ====================================================================
  // UI COMPONENTS - مكونات الواجهة القابلة لإعادة الاستخدام
  // ====================================================================
  class UIComponents {
    // Status display component
    static updateStatus(element, text, type = 'info') {
      if (!element) return;

      element.className = 'mb-2 small d-flex align-items-center gap-1';
      element.classList.remove('text-danger', 'text-success', 'text-primary');

      let icon = '';
      switch (type) {
        case 'loading':
          icon = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
          element.classList.add('text-primary');
          break;
        case 'error':
          icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
          element.classList.add('text-danger');
          break;
        case 'success':
          icon = '<i class="bi bi-check-circle-fill"></i>';
          element.classList.add('text-success');
          break;
        default:
          icon = '<i class="bi bi-info-circle-fill"></i>';
          element.classList.add('text-primary');
      }

      element.innerHTML = `${icon} <span>${UITemplates.escapeHtml(text)}</span>`;
    }

    // Toast notification component
    static showToast(message, type = 'danger') {
      const container = document.querySelector(".toast-container");
      if (!container) {
        console.warn("Toast container not found – fallback to alert");
        alert(message);
        return;
      }

      const toastId = `toast-${Date.now()}`;
      const icons = {
        success: 'bi-check-circle-fill',
        danger: 'bi-exclamation-triangle-fill',
        warning: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill'
      };

      const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
          <div class="d-flex">
            <div class="toast-body">
              <i class="bi ${icons[type] || icons.info} me-1"></i>
              ${UITemplates.escapeHtml(message)}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
          </div>
        </div>`;

      container.insertAdjacentHTML('beforeend', toastHTML);
      const toastEl = document.getElementById(toastId);
      const bsToast = new bootstrap.Toast(toastEl, { delay: CONFIG.UI.TOAST_DURATION });
      toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
      bsToast.show();
    }

    // Efficient DOM update
    static updateDOM(element, newHTML) {
      if (!element) return;
      const currentHTML = element.innerHTML.trim();
      if (currentHTML === newHTML.trim()) return;
      element.innerHTML = newHTML;
    }

    // Create dynamic field for forms
    static createDynamicField(value = '', placeholder = 'Objective') {
      const wrapper = document.createElement('div');
      wrapper.className = 'd-flex gap-2 mb-2';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control form-control-sm';
      input.placeholder = placeholder;
      input.value = value;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.addEventListener('click', () => wrapper.remove());

      wrapper.appendChild(input);
      wrapper.appendChild(deleteBtn);
      return wrapper;
    }
  }

  // ====================================================================
  // UTILITY FUNCTIONS - الدوال المساعدة
  // ====================================================================
  const Utils = {
    // Debounce function for search
    debounce(func, wait = CONFIG.UI.SEARCH_DEBOUNCE_DELAY) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Validate course data
    validateCourseData(courseData) {
      const errors = [];
      
      CONFIG.VALIDATION.REQUIRED_FIELDS.forEach(field => {
        if (!courseData[field] || !courseData[field].toString().trim()) {
          errors.push(`${field} is required`);
        }
      });

      if (courseData.price < CONFIG.VALIDATION.MIN_PRICE) {
        errors.push(`Price must be at least ${CONFIG.VALIDATION.MIN_PRICE}`);
      }

      if (courseData.students < CONFIG.VALIDATION.MIN_STUDENTS) {
        errors.push(`Students count must be at least ${CONFIG.VALIDATION.MIN_STUDENTS}`);
      }

      return errors;
    },

    // Generate unique ID for new courses
    generateTempId() {
      return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  };

  // ====================================================================
  // MAIN APPLICATION CONTROLLER - العقل المدبر للتطبيق
  // ====================================================================
  class CourseAdminApp {
    constructor() {
      this.dataManager = new CourseDataManager();
      this.apiService = new ApiService(CONFIG.API.PROXY_URL);
      this.elements = {};
      this.autoRefreshInterval = null;
      this.cloudinaryWidget = null;
      this.currentUploadTarget = null;
    }

    // Initialize DOM elements
    initializeElements() {
      this.elements = {
        adminGrid: document.getElementById('adminCoursesArea'),
        statusEl: document.getElementById('adminStatus'),
        searchInput: document.getElementById('adminSearch'),
        addCourseBtn: document.getElementById('addCourseBtn'),
        offcanvasEl: document.getElementById('courseEditorOffcanvas'),
        editorForm: document.getElementById('editorForm'),
        editorCourseId: document.getElementById('editorCourseId'),
        editorSaveBtn: document.getElementById('editorSaveBtn'),
        editorDeleteBtn: document.getElementById('editorDeleteBtn'),
        editorObjectivesContainer: document.getElementById('editorObjectives'),
        editorSectionsContainer: document.getElementById('editorSections'),
        editorFaqsContainer: document.getElementById('editorFaqs')
      };

      // Initialize Bootstrap offcanvas
      if (this.elements.offcanvasEl) {
        this.bsOffcanvas = new bootstrap.Offcanvas(this.elements.offcanvasEl);
      }
    }

    // Initialize event listeners
    initializeEventListeners() {
      // Search functionality
      if (this.elements.searchInput) {
        this.elements.searchInput.addEventListener('input', 
          Utils.debounce((e) => this.handleSearch(e.target.value))
        );
      }

      // Add course button
      if (this.elements.addCourseBtn) {
        this.elements.addCourseBtn.addEventListener('click', () => this.openEditor());
      }

      // Course grid actions (edit/delete)
      if (this.elements.adminGrid) {
        this.elements.adminGrid.addEventListener('click', (e) => this.handleGridClick(e));
      }

      // Editor form submission
      if (this.elements.editorForm) {
        this.elements.editorForm.addEventListener('submit', (e) => this.handleEditorSubmit(e));
        this.elements.editorForm.addEventListener('input', () => this.dataManager.setDirty(true));
        this.elements.editorForm.addEventListener('change', () => this.dataManager.setDirty(true));
      }

      // Editor delete button
      if (this.elements.editorDeleteBtn) {
        this.elements.editorDeleteBtn.addEventListener('click', () => this.handleEditorDelete());
      }

      // Dynamic form fields
      this.initializeDynamicFieldButtons();

      // Offcanvas close warning
      if (this.elements.offcanvasEl) {
        this.elements.offcanvasEl.addEventListener('hide.bs.offcanvas', (e) => this.handleOffcanvasClose(e));
      }
    }

    // Handle search input
    handleSearch(searchTerm) {
      const filteredCourses = this.dataManager.filterCourses(searchTerm);
      this.renderCourses(filteredCourses, searchTerm);
    }

    // Handle grid button clicks (edit/delete)
    async handleGridClick(event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const courseId = button.getAttribute('data-course-id');

      if (!courseId) {
        UIComponents.showToast('Course ID missing', 'warning');
        return;
      }

      if (action === 'edit') {
        const course = this.dataManager.findCourseById(courseId);
        if (!course) {
          UIComponents.showToast(`Course ${courseId} not found – refreshing`, 'warning');
          await this.loadCourses();
          return;
        }
        this.openEditor(course);
      } else if (action === 'delete') {
        await this.handleDeleteCourse(courseId);
      }
    }

    // Handle course deletion
    async handleDeleteCourse(courseId) {
      const course = this.dataManager.findCourseById(courseId);
      const courseName = course?.title || `ID: ${courseId}`;
      
      if (!confirm(`⚠️ Delete "${courseName}"?\nThis action cannot be undone!`)) {
        return;
      }

      try {
        await this.apiService.deleteCourse(courseId);
        await this.loadCourses();
        UIComponents.showToast(`Course deleted: ${courseName}`, 'info');
      } catch (error) {
        console.error("Delete Error:", error);
        UIComponents.showToast(`Delete failed: ${error.message}`, 'danger');
      }
    }

    // Load courses from server
    async loadCourses() {
      UIComponents.updateStatus(this.elements.statusEl, "Loading courses...", 'loading');
      this.dataManager.setLoading(true);

      try {
        const response = await this.apiService.loadCourses();
        
        if (Array.isArray(response)) {
          this.dataManager.setCourses(response);
        } else {
          this.dataManager.setCourses([]);
        }

        this.renderCourses();
        const count = this.dataManager.getCoursesCount();
        UIComponents.updateStatus(this.elements.statusEl, `${count.total} courses loaded successfully!`, 'success');
        
      } catch (error) {
        console.error("Load Error:", error);
        UIComponents.updateStatus(this.elements.statusEl, `Load failed: ${error.message}`, 'error');
        
        if (this.elements.adminGrid) {
          this.elements.adminGrid.innerHTML = UITemplates.createErrorState(error.message);
        }
      } finally {
        this.dataManager.setLoading(false);
      }
    }

    // Render courses in the grid
    renderCourses(courses = null, searchTerm = '') {
      const coursesToRender = courses || this.dataManager.getFilteredCourses();
      const allCourses = this.dataManager.getAllCourses();
      
      let html;
      if (coursesToRender.length > 0) {
        html = coursesToRender.map(course => UITemplates.createCourseCard(course)).join('');
      } else {
        html = UITemplates.createEmptyState(!!searchTerm, searchTerm, allCourses.length);
      }

      UIComponents.updateDOM(this.elements.adminGrid, html);

      // Update status
      const count = this.dataManager.getCoursesCount();
      const statusText = searchTerm ? 
        `Found ${count.filtered} of ${count.total} courses` : 
        `Showing ${count.total} courses`;
      UIComponents.updateStatus(this.elements.statusEl, statusText, 'info');
    }

    // Open course editor
    openEditor(course = null) {
      if (!this.elements.editorForm) return;

      this.dataManager.setDirty(false);
      this.elements.editorForm.reset();
      this.elements.editorForm.classList.remove('was-validated');

      // Clear dynamic fields
      if (this.elements.editorObjectivesContainer) {
        this.elements.editorObjectivesContainer.innerHTML = '';
      }
      if (this.elements.editorSectionsContainer) {
        this.elements.editorSectionsContainer.innerHTML = '';
      }
      if (this.elements.editorFaqsContainer) {
        this.elements.editorFaqsContainer.innerHTML = '';
      }

      if (course) {
        this.populateEditor(course);
        document.getElementById('courseEditorLabel').textContent = `Edit Course: ID ${course.id}`;
        this.elements.editorDeleteBtn && (this.elements.editorDeleteBtn.style.display = 'inline-block');
      } else {
        document.getElementById('courseEditorLabel').textContent = 'Add New Course';
        this.elements.editorCourseId.value = '';
        this.addDefaultFormFields();
        this.elements.editorDeleteBtn && (this.elements.editorDeleteBtn.style.display = 'none');
      }

      this.bsOffcanvas && this.bsOffcanvas.show();
    }

    // Populate editor with course data
    populateEditor(course) {
      this.elements.editorCourseId.value = course.id;

      const basicFields = ['title', 'category', 'level', 'price', 'students', 'lessons', 'description', 'instructor'];
      basicFields.forEach(field => {
        const element = document.getElementById(`editor${field.charAt(0).toUpperCase() + field.slice(1)}`);
        if (element && course[field] !== undefined) {
          element.value = course[field];
        }
      });

      // Handle tags
      const tagsEl = document.getElementById('editorTags');
      if (tagsEl && Array.isArray(course.tags)) {
        tagsEl.value = course.tags.join(', ');
      }

      // Handle learning objectives
      if (Array.isArray(course.learningObjectives)) {
        course.learningObjectives.forEach(objective => {
          this.elements.editorObjectivesContainer.appendChild(
            UIComponents.createDynamicField(objective, 'Learning Objective')
          );
        });
      } else {
        this.elements.editorObjectivesContainer.appendChild(
          UIComponents.createDynamicField('', 'Learning Objective')
        );
      }

      // Add other form population logic here...
    }

    // Add default form fields for new course
    addDefaultFormFields() {
      if (this.elements.editorObjectivesContainer) {
        this.elements.editorObjectivesContainer.appendChild(
          UIComponents.createDynamicField('', 'Learning Objective')
        );
      }
    }

    // Initialize dynamic field buttons
    initializeDynamicFieldButtons() {
      document.getElementById('editorAddObjective')?.addEventListener('click', () => {
        const newField = UIComponents.createDynamicField('', 'Learning Objective');
        this.elements.editorObjectivesContainer.appendChild(newField);
        newField.querySelector('input').focus();
        this.dataManager.setDirty(true);
      });

      document.getElementById('editorAddSection')?.addEventListener('click', () => {
        const newField = FormComponents.createSectionCard();
        this.elements.editorSectionsContainer.appendChild(newField);
        newField.querySelector('input').focus();
        this.dataManager.setDirty(true);
      });

      document.getElementById('editorAddFaq')?.addEventListener('click', () => {
        const newField = FormComponents.createFaqCard();
        this.elements.editorFaqsContainer.appendChild(newField);
        newField.querySelector('input').focus();
        this.dataManager.setDirty(true);
      });
    }

    // Handle editor form submission
    async handleEditorSubmit(event) {
      event.preventDefault();

      if (!this.elements.editorForm.checkValidity()) {
        this.elements.editorForm.classList.add('was-validated');
        UIComponents.showToast('Please fill required fields correctly.', 'warning');
        return;
      }

      const courseData = this.collectEditorData();
      const validationErrors = Utils.validateCourseData(courseData);

      if (validationErrors.length > 0) {
        UIComponents.showToast(validationErrors.join(', '), 'warning');
        return;
      }

      const originalButtonText = this.elements.editorSaveBtn?.innerHTML;
      this.setSaveButtonLoading(true);

      try {
        const courseId = this.elements.editorCourseId.value;
        
        if (courseId) {
          await this.apiService.updateCourse(courseId, courseData);
          UIComponents.showToast(`Course "${courseData.title}" updated!`, 'success');
        } else {
          const result = await this.apiService.addCourse(courseData);
          UIComponents.showToast(`New course added with ID: ${result.data?.id}`, 'success');
        }

        await this.loadCourses();
        this.bsOffcanvas && this.bsOffcanvas.hide();
        this.dataManager.setDirty(false);
        
      } catch (error) {
        console.error("Save Error:", error);
        UIComponents.showToast(`Save failed: ${error.message}`, 'danger');
      } finally {
        this.setSaveButtonLoading(false, originalButtonText);
      }
    }

    // Set save button loading state
    setSaveButtonLoading(isLoading, originalText = 'Save Course') {
      if (!this.elements.editorSaveBtn) return;

      if (isLoading) {
        this.elements.editorSaveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Saving...`;
        this.elements.editorSaveBtn.disabled = true;
      } else {
        this.elements.editorSaveBtn.innerHTML = originalText;
        this.elements.editorSaveBtn.disabled = false;
      }
    }

    // Collect data from editor form
    collectEditorData() {
      const courseData = {};

      // Collect basic fields
      const basicFields = ['title', 'category', 'level', 'description', 'instructor'];
      basicFields.forEach(field => {
        const element = document.getElementById(`editor${field.charAt(0).toUpperCase() + field.slice(1)}`);
        courseData[field] = element ? element.value.trim() : '';
      });

      // Collect numeric fields
      const priceEl = document.getElementById('editorPrice');
      const studentsEl = document.getElementById('editorStudents');
      const lessonsEl = document.getElementById('editorLessons');

      courseData.price = priceEl ? (parseFloat(priceEl.value) || 0) : 0;
      courseData.students = studentsEl ? (parseInt(studentsEl.value, 10) || 0) : 0;
      courseData.lessons = lessonsEl ? (parseInt(lessonsEl.value, 10) || 0) : 0;

      // Collect tags
      const tagsEl = document.getElementById('editorTags');
      const tagsValue = tagsEl ? tagsEl.value.trim() : '';
      courseData.tags = tagsValue ? 
        tagsValue.split(/[,،]/).map(t => t.trim()).filter(Boolean) : [];

      // Collect learning objectives
      courseData.learningObjectives = Array.from(
        this.elements.editorObjectivesContainer.querySelectorAll('input')
      ).map(input => input.value.trim()).filter(Boolean);

      // Set default metadata for new courses
      const courseId = this.elements.editorCourseId.value;
      if (courseId) {
        const existingCourse = this.dataManager.findCourseById(courseId);
        if (existingCourse) {
          courseData.date = existingCourse.date;
          courseData.rating = existingCourse.rating;
        }
      } else {
        courseData.date = new Date().toISOString().split('T')[0];
        courseData.rating = 0;
      }

      return courseData;
    }

    // Handle editor delete
    async handleEditorDelete() {
      const courseId = this.elements.editorCourseId.value;
      if (!courseId) return;

      const course = this.dataManager.findCourseById(courseId);
      const courseName = course?.title || `ID: ${courseId}`;
      
      if (!confirm(`⚠️ Are you sure you want to permanently delete:\n\n"${courseName}"\n\nThis action cannot be undone!`)) {
        return;
      }

      try {
        await this.apiService.deleteCourse(courseId);
        await this.loadCourses();
        this.bsOffcanvas && this.bsOffcanvas.hide();
        this.dataManager.setDirty(false);
        UIComponents.showToast(`Course deleted: ${courseName}`, 'info');
      } catch (error) {
        console.error("Delete Error:", error);
        UIComponents.showToast(`Delete failed: ${error.message}`, 'danger');
      }
    }

    // Handle offcanvas close with dirty check
    handleOffcanvasClose(event) {
      if (this.dataManager.getDirty() && !this.dataManager.getLoading()) {
        if (!confirm('⚠️ You have unsaved changes! Are you sure you want to close the editor?')) {
          event.preventDefault();
          return;
        }
        this.dataManager.setDirty(false);
      }
    }

    // Initialize Cloudinary widget
    initializeCloudinaryWidget() {
      const checkInterval = setInterval(() => {
        if (typeof cloudinary !== 'undefined') {
          clearInterval(checkInterval);
          
          try {
            this.cloudinaryWidget = cloudinary.createUploadWidget({
              cloudName: CONFIG.API.CLOUDINARY_CLOUD_NAME,
              uploadPreset: CONFIG.API.CLOUDINARY_UPLOAD_PRESET,
              folder: 'courses',
              sources: ['local', 'url', 'camera'],
              cropping: true,
              croppingAspectRatio: 1.91,
              multiple: false,
              resourceType: 'image'
            }, (error, result) => this.handleCloudinaryUpload(error, result));

            // Add event listeners for upload buttons
            document.getElementById('uploadCardBtn')?.addEventListener('click', () => {
              this.currentUploadTarget = 'card';
              this.cloudinaryWidget.open();
            });

            document.getElementById('uploadDetailsBtn')?.addEventListener('click', () => {
              this.currentUploadTarget = 'details';
              this.cloudinaryWidget.open();
            });

            console.log('✅ Cloudinary Widget initialized');
          } catch (error) {
            console.error('Cloudinary initialization error:', error);
          }
        }
      }, 100);
    }

    // Handle Cloudinary upload result
    handleCloudinaryUpload(error, result) {
      if (error) {
        console.error('Cloudinary Error:', error);
        UIComponents.showToast(`Image upload failed: ${error.message}`, 'danger');
        return;
      }

      if (result && result.event === "success") {
        const publicId = result.info.public_id;
        const thumbnailUrl = result.info.thumbnail_url;

        if (this.currentUploadTarget === 'card') {
          const inputEl = document.getElementById('editorImageCard');
          const previewEl = document.getElementById('previewImageCard');
          
          if (inputEl) inputEl.value = publicId;
          if (previewEl) {
            previewEl.src = thumbnailUrl;
            previewEl.style.display = 'block';
          }
          
          UIComponents.showToast('Card image uploaded!', 'success');
        } else if (this.currentUploadTarget === 'details') {
          const inputEl = document.getElementById('editorImageDetails');
          const previewEl = document.getElementById('previewImageDetails');
          
          if (inputEl) inputEl.value = publicId;
          if (previewEl) {
            previewEl.src = thumbnailUrl;
            previewEl.style.display = 'block';
          }
          
          UIComponents.showToast('Details image uploaded!', 'success');
        }

        this.dataManager.setDirty(true);
      }
    }

    // Setup auto refresh
    setupAutoRefresh() {
      this.autoRefreshInterval = setInterval(async () => {
        if (document.visibilityState === 'visible' && 
            !this.dataManager.getDirty() && 
            !this.dataManager.getLoading()) {
          try {
            await this.loadCourses();
          } catch (error) {
            console.warn('Auto-refresh failed:', error.message);
          }
        }
      }, CONFIG.UI.AUTO_REFRESH_INTERVAL);
    }

    // Cleanup method
    destroy() {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
      }
    }

    // Initialize the entire application
    async initialize() {
      console.log('🚀 Initializing Courses Admin Panel...');
      
      try {
        this.initializeElements();
        this.initializeEventListeners();
        await this.loadCourses();
        this.initializeCloudinaryWidget();
        this.setupAutoRefresh();
        
        console.log('✅ Application initialized successfully');
        UIComponents.updateStatus(this.elements.statusEl, 'Application ready', 'success');
      } catch (error) {
        console.error('Initialization failed:', error);
        UIComponents.updateStatus(this.elements.statusEl, `Initialization failed: ${error.message}`, 'error');
        throw error;
      }
    }
  }

  // ====================================================================
  // ENHANCED FORM COMPONENTS - مكونات النماذج المتقدمة
  // ====================================================================
  class FormComponents {
    // Create section card for curriculum
    static createSectionCard(title = '', lessons = []) {
      const card = document.createElement('div');
      card.className = 'border rounded p-3 mb-2';

      const header = document.createElement('div');
      header.className = 'd-flex gap-2 mb-2';

      const titleInput = document.createElement('input');
      titleInput.className = 'form-control form-control-sm fw-bold';
      titleInput.placeholder = 'Section title (e.g., Introduction)';
      titleInput.value = title;

      const addLessonBtn = document.createElement('button');
      addLessonBtn.type = 'button';
      addLessonBtn.className = 'btn btn-sm btn-outline-primary';
      addLessonBtn.innerHTML = '<i class="bi bi-plus"></i> Lesson';

      const deleteSectionBtn = document.createElement('button');
      deleteSectionBtn.type = 'button';
      deleteSectionBtn.className = 'btn btn-sm btn-outline-danger';
      deleteSectionBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteSectionBtn.addEventListener('click', () => card.remove());

      header.appendChild(titleInput);
      header.appendChild(addLessonBtn);
      header.appendChild(deleteSectionBtn);

      const lessonsContainer = document.createElement('div');
      lessonsContainer.className = 'section-lessons-container';
      
      lessons.forEach(lesson => {
        lessonsContainer.appendChild(UIComponents.createDynamicField(lesson, 'Lesson title'));
      });

      addLessonBtn.addEventListener('click', () => {
        const newLesson = UIComponents.createDynamicField('', 'Lesson title');
        lessonsContainer.appendChild(newLesson);
        newLesson.querySelector('input').focus();
      });

      card.appendChild(header);
      card.appendChild(lessonsContainer);
      return card;
    }

    // Create FAQ card
    static createFaqCard(question = '', answer = '') {
      const card = document.createElement('div');
      card.className = 'border rounded p-3 mb-2';

      const questionInput = document.createElement('input');
      questionInput.type = 'text';
      questionInput.className = 'form-control form-control-sm mb-2';
      questionInput.placeholder = 'Frequently Asked Question';
      questionInput.value = question;

      const answerTextarea = document.createElement('textarea');
      answerTextarea.rows = 2;
      answerTextarea.className = 'form-control form-control-sm mb-2';
      answerTextarea.placeholder = 'Answer to the question';
      answerTextarea.value = answer;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i> Delete FAQ';
      deleteBtn.addEventListener('click', () => card.remove());

      card.appendChild(questionInput);
      card.appendChild(answerTextarea);
      card.appendChild(deleteBtn);
      return card;
    }
  }

  // ====================================================================
  // APPLICATION INSTANCE & INITIALIZATION - تهيئة التطبيق
  // ====================================================================
  let appInstance = null;

  // Initialize application when DOM is ready
  function initializeApplication() {
    try {
      appInstance = new CourseAdminApp();
      appInstance.initialize();
    } catch (error) {
      console.error('Failed to initialize application:', error);
      
      // Fallback error display
      const statusEl = document.getElementById('adminStatus');
      if (statusEl) {
        UIComponents.updateStatus(statusEl, `Startup failed: ${error.message}`, 'error');
      }
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (appInstance) {
      appInstance.destroy();
    }
  });

  // ====================================================================
  // PUBLIC API - واجهة برمجة عامة (اختيارية)
  // ====================================================================
  window.CourseAdminPanel = {
    // Reload courses
    async refresh() {
      if (appInstance) {
        await appInstance.loadCourses();
      }
    },

    // Get courses data
    getCourses() {
      return appInstance ? appInstance.dataManager.getAllCourses() : [];
    },

    // Get filtered courses
    getFilteredCourses() {
      return appInstance ? appInstance.dataManager.getFilteredCourses() : [];
    },

    // Open editor for specific course
    editCourse(courseId) {
      if (appInstance) {
        const course = appInstance.dataManager.findCourseById(courseId);
        if (course) {
          appInstance.openEditor(course);
        }
      }
    },

    // Get application status
    getStatus() {
      if (!appInstance) return { status: 'not_initialized' };
      
      return {
        status: 'ready',
        isLoading: appInstance.dataManager.getLoading(),
        isDirty: appInstance.dataManager.getDirty(),
        coursesCount: appInstance.dataManager.getCoursesCount()
      };
    }
  };

  // ====================================================================
  // START APPLICATION - بدء التطبيق
  // ====================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
  } else {
    initializeApplication();
  }

})();
