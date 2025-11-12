// Admin Events Dashboard Handler
(function() {
    'use strict';

    let allEvents = [];
    let eventToDelete = null;

    // Session validation
    function validateSession() {
        const adminId = sessionStorage.getItem('gfg_admin_id');
        const adminEmail = sessionStorage.getItem('gfg_admin_email');
        const sessionToken = sessionStorage.getItem('gfg_session_token');
        const sessionExpiry = sessionStorage.getItem('gfg_session_expiry');

        if (!adminId || !adminEmail || !sessionToken || !sessionExpiry) {
            window.location.href = 'index.html';
            return false;
        }

        // Check if session expired
        if (Date.now() > parseInt(sessionExpiry)) {
            clearSession();
            alert('Session expired. Please login again.');
            window.location.href = 'index.html';
            return false;
        }

        return true;
    }

    // Clear session
    function clearSession() {
        sessionStorage.removeItem('gfg_admin_id');
        sessionStorage.removeItem('gfg_admin_email');
        sessionStorage.removeItem('gfg_session_token');
        sessionStorage.removeItem('gfg_session_expiry');
    }

    // Check session on load
    if (!validateSession()) return;

    // Display admin email
    const adminEmail = sessionStorage.getItem('gfg_admin_email');
    document.getElementById('admin-email-display').textContent = adminEmail;

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', () => {
        clearSession();
        window.location.href = 'index.html';
    });

    // Load events from Supabase
    async function loadEvents() {
        try {
            const { data, error } = await window.supabaseClient
                .from('events')
                .select(`
                    *,
                    event_registrations(count)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            allEvents = data || [];
            displayEvents(allEvents);
            updateStats(allEvents);
        } catch (error) {
            console.error('Error loading events:', error);
            document.getElementById('events-table-body').innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-red-500">
                        <p>Error loading events. Please refresh the page.</p>
                    </td>
                </tr>
            `;
        }
    }

    // Display events in table
    function displayEvents(events) {
        const tbody = document.getElementById('events-table-body');
        
        if (events.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                        <i data-feather="calendar" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                        <p class="text-lg mb-2">No events found</p>
                        <p class="text-sm">Create your first event to get started</p>
                    </td>
                </tr>
            `;
            feather.replace();
            return;
        }

        tbody.innerHTML = events.map(event => {
            const eventDate = new Date(event.event_date);
            const registrationCount = event.event_registrations?.[0]?.count || 0;
            
            // Status badges
            let statusBadges = [];
            if (event.is_draft) {
                statusBadges.push('<span class="px-2 py-1 text-xs rounded bg-yellow-900/30 text-yellow-400 border border-yellow-800">Draft</span>');
            } else if (event.is_visible) {
                statusBadges.push('<span class="px-2 py-1 text-xs rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800">Published</span>');
            } else {
                statusBadges.push('<span class="px-2 py-1 text-xs rounded bg-gray-700 text-gray-400">Hidden</span>');
            }
            
            if (event.is_featured) {
                statusBadges.push('<span class="px-2 py-1 text-xs rounded bg-blue-900/30 text-blue-400 border border-blue-800">Featured</span>');
            }
            
            if (!event.registration_open) {
                statusBadges.push('<span class="px-2 py-1 text-xs rounded bg-red-900/30 text-red-400 border border-red-800">Closed</span>');
            }

            return `
                <tr class="hover:bg-gray-800/50 transition">
                    <td class="px-6 py-4">
                        <div class="font-medium">${escapeHtml(event.title)}</div>
                        ${event.venue ? `<div class="text-sm text-gray-400 mt-1"><i data-feather="map-pin" class="w-3 h-3 inline"></i> ${escapeHtml(event.venue)}</div>` : ''}
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-sm">${formatDate(eventDate)}</div>
                        <div class="text-xs text-gray-400">${formatTime(eventDate)}</div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="text-sm">${event.event_type || 'Other'}</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <i data-feather="users" class="w-4 h-4 text-gray-400"></i>
                            <span class="font-medium">${registrationCount}</span>
                            ${event.max_participants ? `<span class="text-xs text-gray-500">/ ${event.max_participants}</span>` : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-wrap gap-1">
                            ${statusBadges.join('')}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="viewRegistrations('${event.id}')" class="p-2 hover:bg-gray-800 rounded transition" title="View Registrations">
                                <i data-feather="users" class="w-4 h-4"></i>
                            </button>
                            <button onclick="editEvent('${event.id}')" class="p-2 hover:bg-gray-800 rounded transition" title="Edit">
                                <i data-feather="edit-2" class="w-4 h-4"></i>
                            </button>
                            <button onclick="toggleEventVisibility('${event.id}', ${!event.is_visible})" class="p-2 hover:bg-gray-800 rounded transition" title="${event.is_visible ? 'Hide' : 'Show'}">
                                <i data-feather="${event.is_visible ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteEvent('${event.id}', '${escapeHtml(event.title)}')" class="p-2 hover:bg-red-900/50 text-red-400 rounded transition" title="Delete">
                                <i data-feather="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        feather.replace();
    }

    // Update statistics
    function updateStats(events) {
        const totalEvents = events.length;
        const publishedEvents = events.filter(e => !e.is_draft && e.is_visible).length;
        const draftEvents = events.filter(e => e.is_draft).length;
        const totalRegistrations = events.reduce((sum, e) => sum + (e.event_registrations?.[0]?.count || 0), 0);

        document.getElementById('stat-total').textContent = totalEvents;
        document.getElementById('stat-published').textContent = publishedEvents;
        document.getElementById('stat-drafts').textContent = draftEvents;
        document.getElementById('stat-registrations').textContent = totalRegistrations;
    }

    // Filter events
    function filterEvents() {
        const searchTerm = document.getElementById('search-events').value.toLowerCase();
        const statusFilter = document.getElementById('filter-status').value;

        let filtered = allEvents;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(event => 
                event.title.toLowerCase().includes(searchTerm) ||
                (event.description && event.description.toLowerCase().includes(searchTerm)) ||
                (event.venue && event.venue.toLowerCase().includes(searchTerm))
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(event => {
                switch(statusFilter) {
                    case 'published':
                        return !event.is_draft && event.is_visible;
                    case 'draft':
                        return event.is_draft;
                    case 'featured':
                        return event.is_featured;
                    case 'closed':
                        return !event.registration_open;
                    default:
                        return true;
                }
            });
        }

        displayEvents(filtered);
    }

    // Event handlers
    document.getElementById('search-events').addEventListener('input', filterEvents);
    document.getElementById('filter-status').addEventListener('change', filterEvents);

    // Create new event
    document.getElementById('create-event-btn').addEventListener('click', () => {
        window.location.href = 'admin-event-create.html';
    });

    // Global functions for inline event handlers
    window.editEvent = function(eventId) {
        window.location.href = `admin-event-create.html?id=${eventId}`;
    };

    window.viewRegistrations = function(eventId) {
        window.location.href = `admin-event-registrations.html?event=${eventId}`;
    };

    window.toggleEventVisibility = async function(eventId, makeVisible) {
        try {
            const { error } = await window.supabaseClient
                .from('events')
                .update({ is_visible: makeVisible })
                .eq('id', eventId);

            if (error) throw error;

            await loadEvents();
        } catch (error) {
            console.error('Error toggling visibility:', error);
            alert('Failed to update event visibility');
        }
    };

    window.deleteEvent = function(eventId, eventTitle) {
        eventToDelete = eventId;
        document.getElementById('delete-modal').classList.remove('hidden');
        document.getElementById('delete-modal').classList.add('flex');
    };

    // Delete modal handlers
    document.getElementById('cancel-delete').addEventListener('click', () => {
        document.getElementById('delete-modal').classList.add('hidden');
        document.getElementById('delete-modal').classList.remove('flex');
        eventToDelete = null;
    });

    document.getElementById('confirm-delete').addEventListener('click', async () => {
        if (!eventToDelete) return;

        try {
            const { error } = await window.supabaseClient
                .from('events')
                .delete()
                .eq('id', eventToDelete);

            if (error) throw error;

            document.getElementById('delete-modal').classList.add('hidden');
            document.getElementById('delete-modal').classList.remove('flex');
            eventToDelete = null;

            await loadEvents();
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Failed to delete event');
        }
    });

    // Utility functions
    function formatDate(date) {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }

    function formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Check session expiry every minute
    setInterval(() => {
        validateSession();
    }, 60000);

    // Initial load
    loadEvents();
})();
