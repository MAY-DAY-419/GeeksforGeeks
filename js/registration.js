document.addEventListener('DOMContentLoaded', function() {
    if (window.feather && typeof feather.replace === 'function') {
        feather.replace();
    }

    // Initialize particles if available (won't break if file missing)
    try {
        if (window.particlesJS) {
            particlesJS.load('particles-js', 'particles.json', function() {
                // Particles loaded
            });
        }
    } catch (_) {}

    // Pre-fill event details from URL params
    var urlParams = new URLSearchParams(window.location.search);
    var eventName = urlParams.get('event');
    var eventDate = urlParams.get('date');
    if (eventName) {
        var decoded = decodeURIComponent(eventName);
        var titleEl = document.getElementById('event-title');
        if (titleEl) titleEl.textContent = decoded;
    }
    if (eventDate) {
        var dateEl = document.getElementById('event-date');
        if (dateEl) dateEl.textContent = decodeURIComponent(eventDate);
    }

    var form = document.getElementById('registration-form');
    if (!form) return;

    function showToast(message, type) {
        var toast = document.getElementById('toast');
        var body = document.getElementById('toast-body');
        if (!toast || !body) return;
        body.textContent = message;
        body.className = 'px-4 py-2 rounded-lg font-semibold shadow-lg ' + (type === 'error' ? 'bg-red-500 text-black' : 'bg-emerald-600 text-black');
        toast.classList.remove('hidden');
        setTimeout(function() { toast.classList.add('hidden'); }, 2500);
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        var payload = {
            name: document.getElementById('name') ? document.getElementById('name').value.trim() : '',
            email: document.getElementById('email') ? document.getElementById('email').value.trim() : '',
            prn: document.getElementById('roll') ? document.getElementById('roll').value.trim() : '',
            department: document.getElementById('department') ? document.getElementById('department').value : '',
            year: document.getElementById('year') ? document.getElementById('year').value : '',
            phone: document.getElementById('phone') ? document.getElementById('phone').value.trim() : '',
            upi: document.getElementById('upi') ? document.getElementById('upi').value.trim() : null,
            transaction_id: document.getElementById('transaction') ? document.getElementById('transaction').value.trim() : '',
            event_name: eventName ? decodeURIComponent(eventName) : document.getElementById('event-title').textContent,
            event_date: eventDate ? decodeURIComponent(eventDate) : document.getElementById('event-date').textContent
        };

        // Basic front-end validation
        var requiredFields = ['name', 'email', 'prn', 'department', 'year', 'phone', 'transaction_id'];
        for (var i = 0; i < requiredFields.length; i++) {
            var key = requiredFields[i];
            if (!payload[key] || payload[key].length === 0) {
                alert('Please fill out ' + key.replace('_', ' ') + '.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Registration';
                }
                return;
            }
        }

        // Additional lightweight validations
        var emailOk = /.+@.+\..+/.test(payload.email);
        if (!emailOk) {
            document.getElementById('email').setCustomValidity('Enter a valid email');
            document.getElementById('email').reportValidity();
            showToast('Invalid email address', 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Registration'; }
            return;
        }
        var phoneOk = /^[0-9\-\s()+]{7,15}$/.test(payload.phone);
        if (!phoneOk) {
            document.getElementById('phone').setCustomValidity('Enter a valid phone number');
            document.getElementById('phone').reportValidity();
            showToast('Invalid phone number', 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Registration'; }
            return;
        }
        // clear custom validity
        document.getElementById('email').setCustomValidity('');
        document.getElementById('phone').setCustomValidity('');

        if (!window.supabaseClient) {
            console.error('Supabase client is not initialized.');
            alert('Configuration error: Supabase not initialized. Please set your project keys.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Registration';
            }
            return;
        }

        try {
            // Upsert to avoid duplicate registrations per (event_name, prn)
            var insertResult = await window.supabaseClient
                .from('registrations')
                .upsert(payload, { onConflict: 'event_name,prn' });

            if (insertResult.error) {
                console.error(insertResult.error);
                showToast('Failed: ' + insertResult.error.message, 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Registration';
                }
                return;
            }

            // Success UI
            var success = document.getElementById('success-message');
            form.classList.add('hidden');
            if (success) success.classList.remove('hidden');
            showToast('Registration successful!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Unexpected error. Please try again.', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Registration';
            }
        }
    });
});


