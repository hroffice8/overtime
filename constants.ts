export const API_URL = "https://script.google.com/macros/s/AKfycbyGvPes-Dg7Mzh2_Sr_NbZ_AA3fD2NQTka5n9EeLAQ23kFHorDMoWxAdthLStwHa3H0XA/exec";

export const APP_TITLE = "DIU Holiday and Overtime Duty Review Portal";
export const APP_SUBTITLE = "Overtime and Holiday Duty Summary";

export const LOGIC_SCRIPT = `
const getEl = (id) => document.getElementById(id);

function searchEmployee() {
    const id = getEl('searchInput').value;
    if (!id) return alert('Please enter Employee ID');

    getEl('loader').classList.remove('hidden');
    getEl('resultArea').classList.add('hidden');

    fetch(API_URL + '?action=search&id=' + id)
        .then(res => res.json())
        .then(data => {
            getEl('loader').classList.add('hidden');
            if (data.found) {
                getEl('dispId').innerText = data.info.id;
                getEl('dispName').innerText = data.info.name;
                getEl('dispDesig').innerText = data.info.designation;
                getEl('dispDept').innerText = data.info.department;
                getEl('empId').value = data.info.id;
                
                const tbody = getEl('tableBody');
                tbody.innerHTML = '';
                data.records.forEach(r => {
                    tbody.innerHTML += '<tr class="border-b hover:bg-gray-50">' +
                        '<td class="px-4 py-3">' + r.date + '</td>' +
                        '<td class="px-4 py-3">' + r.day + '</td>' +
                        '<td class="px-4 py-3">' + r.schIn + '</td>' +
                        '<td class="px-4 py-3">' + r.schOut + '</td>' +
                        '<td class="px-4 py-3">' + r.chkIn + '</td>' +
                        '<td class="px-4 py-3">' + r.chkOut + '</td>' +
                        '<td class="px-4 py-3">' + r.total + '</td>' +
                        '<td class="px-4 py-3">' + r.status + '</td>' +
                        '</tr>';
                });

                getEl('resultArea').classList.remove('hidden');
                getEl('instructionModal').classList.remove('hidden');
            } else {
                alert('Employee not found!');
            }
        })
        .catch(err => {
            getEl('loader').classList.add('hidden');
            alert('Error fetching data');
        });
}

function closeInstructions() {
    getEl('instructionModal').classList.add('hidden');
}

function initiateOtp() {
    const email = getEl('supervisorEmail').value;
    const supId = getEl('supervisorId').value;
    
    if (!getEl('termsCheckbox').checked) return alert('Please agree to terms');
    if (!supId) return alert('Enter Supervisor ID');
    if (!email) return alert('Enter Supervisor Email');

    getEl('otpBtn').innerText = 'Sending...';
    getEl('otpBtn').disabled = true;

    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'sendOtp', email: email })
    })
    .then(res => res.json())
    .then(data => {
        getEl('otpBtn').innerText = 'Request OTP & Submit';
        getEl('otpBtn').disabled = false;
        if (data.success) {
            getEl('otpModal').classList.remove('hidden');
            startTimer();
        } else {
            alert('Failed to send OTP: ' + data.message);
        }
    })
    .catch(err => {
        getEl('otpBtn').innerText = 'Request OTP & Submit';
        getEl('otpBtn').disabled = false;
        alert('Error sending OTP');
    });
}

function verifyOtp() {
    const otp = getEl('otpInput').value;
    const formData = {
        empId: getEl('empId').value,
        supId: getEl('supervisorId').value,
        otDutyDays: getEl('otDutyDays').value || '0',
        totalOtHours: getEl('totalOtHours').value || '0',
        totalHolidayDays: getEl('totalHolidayDays').value || '0',
        totalHolidayHours: getEl('totalHolidayHours').value || '0'
    };

    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'verify',
            email: getEl('supervisorEmail').value,
            otp: otp,
            formData: formData
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            getEl('otpModal').classList.add('hidden');
            getEl('searchSection').classList.add('hidden');
            getEl('resultArea').classList.add('hidden');
            getEl('successPage').classList.remove('hidden');
        } else {
            alert(data.message);
        }
    })
    .catch(err => alert('Verification Error'));
}

function startTimer() {
    let timer = 120;
    const interval = setInterval(() => {
        const m = Math.floor(timer / 60).toString().padStart(2, '0');
        const s = (timer % 60).toString().padStart(2, '0');
        getEl('timer').innerText = m + ':' + s;
        if (--timer < 0) clearInterval(interval);
    }, 1000);
}
`;
