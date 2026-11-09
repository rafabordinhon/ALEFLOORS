// Contact page: quote request form.
// 1) "Send Request" posts the form to Netlify Forms (the lead is stored and emailed),
//    then goes to the thank-you page. If that fails, the visitor is told to use WhatsApp or call.
// 2) "Send via WhatsApp" opens WhatsApp with the same details already typed.
// Without JavaScript the form still works: the browser posts it to Netlify directly.
(() => {
    'use strict';

    const form = document.getElementById('contactForm');
    if (!form) return;

    const WHATSAPP_NUMBER = '13479986695';
    const submitButton = form.querySelector('button[type="submit"]');
    const whatsappButton = document.getElementById('whatsappBtn');
    const status = document.getElementById('formStatus');
    const track = (name, params) => { if (typeof window.aleTrack === 'function') window.aleTrack(name, params); };

    const value = (name) => (form.elements[name] ? form.elements[name].value.trim() : '');

    function setStatus(message, isError) {
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('is-error', Boolean(isError));
        status.hidden = !message;
    }

    function whatsappUrl() {
        const service = form.elements.service;
        const serviceName = service && service.selectedIndex > 0 ? service.options[service.selectedIndex].text : 'Not sure yet';
        const consultation = form.elements.consultation && form.elements.consultation.checked ? 'Yes' : 'No';
        const lines = [
            '*New Quote Request - Ale Floors*',
            '',
            '*Name:* ' + value('name'),
            '*Email:* ' + value('email'),
            '*Phone:* ' + value('phone'),
            '*Location:* ' + value('location'),
            '*Service:* ' + serviceName,
            '*Area:* ' + (value('area') || 'Not specified'),
            '*Free on-site consultation:* ' + consultation,
            '',
            '*Project details:*',
            value('message'),
        ];
        return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
    }

    if (whatsappButton) {
        whatsappButton.addEventListener('click', () => {
            if (!form.reportValidity()) return;
            track('generate_lead', { method: 'whatsapp' });
            window.open(whatsappUrl(), '_blank', 'noopener');
        });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        submitButton.disabled = true;
        submitButton.classList.add('loading');
        setStatus('Sending your request…', false);

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(form)).toString(),
                signal: AbortSignal.timeout(15000), // give up after 15 s instead of hanging
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            track('generate_lead', { method: 'form' });
            window.location.href = form.getAttribute('action') || 'thank-you.html';
        } catch (error) {
            setStatus('Your request was not sent. Check your connection and try again, or send it with the WhatsApp button below or call +1 (347) 998-6695.', true);
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
        }
    });
})();
