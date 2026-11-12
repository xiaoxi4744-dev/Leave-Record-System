import supabase from "./supabase.js";

const personId = document.getElementById("personId");
const personSearch = document.getElementById("personSearch");
const personSuggestions = document.getElementById("personSuggestions");

const leaveForm = document.getElementById("leaveForm");

const historySection = document.getElementById("historySection");
const historyTable = document.getElementById("historyTable");

const formMessage = document.getElementById("formMessage");
const saveBtn = document.getElementById("saveBtn");

const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const daysInput = document.getElementById("days");

const personModal = document.getElementById("personModal");
const modalSearch = document.getElementById("modalSearch");
const modalPersonList = document.getElementById("modalPersonList");

const historySearchModal = document.getElementById("historySearchModal");
const historySearchInput = document.getElementById("historySearchInput");
const historyPersonList = document.getElementById("historyPersonList");

const addPersonForm = document.getElementById("addPersonForm");
const newPersonName = document.getElementById("newPersonName");
const newPersonPosition = document.getElementById("newPersonPosition");
const savePersonBtn = document.getElementById("savePerson");
const personMessage = document.getElementById("personMessage");

let persons = [];
let currentPerson = null;
let currentHistory = [];

const leaveTypes = [
    "ลาป่วย",
    "ลากิจส่วนตัว",
    "ลาคลอดบุตร",
    "ลาอุปสมบท",
    "ไปราชการ"
];

const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม"
];

/* POSITION ORDER */

const positionOrder = [
    "ผอ.",
    "รองผู้อำนวยการ",
    "ครูผู้ช่วยผู้อำนวยการ",
    "ครู",
    "ครูผู้ช่วย",
    "ครูอัตราจ้าง",
    "พนักงานราชการ",
    "พนักงานธุรการ",
    "พัสดุ",
    "ลูกจ้างฯ",
    "พนักงานบริการ",
    "เจ้าหน้าที่ฯ"
];

const positionLabels = {
    "ผอ.": "ผู้อำนวยการ",
    "รองผู้อำนวยการ": "รองผู้อำนวยการ",
    "ครูผู้ช่วยผู้อำนวยการ": "ครูผู้ช่วยผู้อำนวยการ",
    "ครู": "ครู",
    "ครูผู้ช่วย": "ครูผู้ช่วย",
    "ครูอัตราจ้าง": "ครูอัตราจ้าง",
    "พนักงานราชการ": "พนักงานราชการ",
    "พนักงานธุรการ": "พนักงานธุรการ",
    "พัสดุ": "พัสดุ",
    "ลูกจ้างฯ": "ลูกจ้างฯ",
    "พนักงานบริการ": "พนักงานบริการ",
    "เจ้าหน้าที่ฯ": "เจ้าหน้าที่ฯ"
};

function getPositionLabel(position) {
    return positionLabels[position] || position || "ไม่ระบุตำแหน่ง";
}

function sortPersonsByPosition(data) {
    return [...data].sort((a, b) => {
        const indexA = positionOrder.indexOf(a.position);
        const indexB = positionOrder.indexOf(b.position);

        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return (a.full_name || "").localeCompare(
            b.full_name || "",
            "th"
        );
    });
}

/* FORMAT DATE */

function formatDate(date) {
    if (!date) return "-";

    const [year, month, day] = String(date).split("-");

    return `${day}/${month}/${Number(year) + 543}`;
}

function formatDateTime(date) {
    if (!date) return "-";

    return new Date(date).toLocaleString("th-TH", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function formatMonth(month) {
    return thaiMonths[month];
}

/* DATE UTILITIES */

function dateToUTC(date) {
    const [year, month, day] = String(date).split("-").map(Number);

    return Date.UTC(year, month - 1, day);
}

function dateFromUTC(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function getDateRangeDays(start, end) {
    const startTime = dateToUTC(start);
    const endTime = dateToUTC(end);

    return Math.floor((endTime - startTime) / 86400000) + 1;
}

function getOverlapDays(start, end, rangeStart, rangeEnd) {
    const actualStart = Math.max(
        dateToUTC(start),
        dateToUTC(rangeStart)
    );

    const actualEnd = Math.min(
        dateToUTC(end),
        dateToUTC(rangeEnd)
    );

    if (actualEnd < actualStart) return 0;

    return Math.floor(
        (actualEnd - actualStart) / 86400000
    ) + 1;
}

/* CSV UTILITIES */

function escapeCSV(value) {
    let text = String(value ?? "");

    if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(rows, filename) {
    const csvContent = rows
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

/* FETCH ALL SUPABASE ROWS */

async function fetchAllRows(table, columns) {
    const pageSize = 1000;
    let allRows = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .range(from, from + pageSize - 1);

        if (error) {
            throw error;
        }

        allRows = allRows.concat(data || []);

        if (!data || data.length < pageSize) {
            break;
        }

        from += pageSize;
    }

    return allRows;
}

/* MESSAGE */

function showMessage(message, success) {
    formMessage.textContent = message;
    formMessage.style.color = success ? "#16a34a" : "#dc2626";
}

/* CALCULATE DAYS */

function calculateLeaveDays() {
    const start = startDate.value;
    const end = endDate.value;

    endDate.setCustomValidity("");

    if (!start || !end) {
        daysInput.value = "";
        return;
    }

    if (end < start) {
        daysInput.value = "";

        endDate.setCustomValidity(
            "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา"
        );

        return;
    }

    daysInput.value = getDateRangeDays(start, end);
}

startDate.addEventListener("change", calculateLeaveDays);
endDate.addEventListener("change", calculateLeaveDays);

/* LOAD PERSONS */

async function loadPersons() {
    const { data, error } = await supabase
        .from("persons")
        .select("id, full_name, position, created_at");

    if (error) {
        document.getElementById("personCount").textContent =
            "โหลดรายชื่อไม่สำเร็จ";

        modalPersonList.textContent = error.message;
        historyPersonList.textContent = error.message;

        console.error(error);

        return false;
    }

    persons = sortPersonsByPosition(data || []);

    renderModalPersons(persons);
    renderHistoryPersons(persons);

    document.getElementById("personCount").textContent =
        `${persons.length} คน`;

    return true;
}

/* SELECT PERSON */

function selectPerson(person) {
    personId.value = person.id;
    personSearch.value = person.full_name;

    personSuggestions.hidden = true;
    personSuggestions.replaceChildren();
}

/* SEARCH SUGGESTIONS */

function renderSuggestions(keyword) {
    personSuggestions.replaceChildren();

    if (!keyword.trim()) {
        personSuggestions.hidden = true;
        return;
    }

    const filtered = sortPersonsByPosition(
        persons.filter(person =>
            person.full_name.toLowerCase().includes(keyword.toLowerCase())
        )
    );

    if (filtered.length === 0) {
        const empty = document.createElement("div");

        empty.className = "suggestion-empty";
        empty.textContent = "ไม่พบรายชื่อบุคลากร";

        personSuggestions.appendChild(empty);
        personSuggestions.hidden = false;

        return;
    }

    filtered.slice(0, 10).forEach(person => {
        const item = document.createElement("div");

        item.className = "suggestion-item";

        const name = document.createElement("strong");
        name.textContent = person.full_name;

        const position = document.createElement("small");
        position.textContent = getPositionLabel(person.position);

        item.append(name, position);

        item.addEventListener("click", () => {
            selectPerson(person);
        });

        personSuggestions.appendChild(item);
    });

    personSuggestions.hidden = false;
}

personSearch.addEventListener("input", () => {
    personId.value = "";

    renderSuggestions(personSearch.value);
});

personSearch.addEventListener("focus", () => {
    if (personSearch.value.trim()) {
        renderSuggestions(personSearch.value);
    }
});

document.addEventListener("click", event => {
    if (!event.target.closest(".search-select")) {
        personSuggestions.hidden = true;
    }
});

/* OPEN PERSON MODAL */

document.getElementById("openPersonModal").addEventListener("click", async () => {
    personModal.hidden = false;

    document.body.style.overflow = "hidden";

    modalSearch.value = "";

    addPersonForm.hidden = true;

    await loadPersons();
});

/* CLOSE PERSON MODAL */

function closePersonModal() {
    personModal.hidden = true;

    document.body.style.overflow = "";
}

document.getElementById("closePersonModal").addEventListener(
    "click",
    closePersonModal
);

document.getElementById("closeModalBackdrop").addEventListener(
    "click",
    closePersonModal
);

/* CREATE PERSON ITEM */

function createPersonItem(person, mode) {
    const item = document.createElement("div");

    item.className = "modal-person-item";

    const info = document.createElement("div");

    info.className = "person-info";

    const name = document.createElement("h3");

    name.textContent = person.full_name;

    const detail = document.createElement("p");

    detail.textContent = getPositionLabel(person.position);

    info.append(name, detail);

    if (mode === "manage") {
        info.addEventListener("click", () => {
            selectPerson(person);

            closePersonModal();
        });

        const deleteBtn = document.createElement("button");

        deleteBtn.type = "button";
        deleteBtn.className = "person-delete-btn";
        deleteBtn.textContent = "ลบ";

        deleteBtn.addEventListener("click", async event => {
            event.stopPropagation();

            await deletePerson(person);
        });

        item.append(info, deleteBtn);
    } else {
        item.appendChild(info);

        item.addEventListener("click", async () => {
            closeHistoryModal();

            await loadPersonHistory(person);
        });
    }

    return item;
}

/* RENDER GROUPED PERSON LIST */

function renderGroupedPersons(data, container, mode) {
    container.replaceChildren();

    if (data.length === 0) {
        const empty = document.createElement("p");

        empty.className = "empty";
        empty.textContent = "ไม่พบรายชื่อบุคลากร";

        container.appendChild(empty);

        return;
    }

    const sortedPersons = sortPersonsByPosition(data);

    const groupedPersons = new Map();

    sortedPersons.forEach(person => {
        const position = person.position || "ไม่ระบุตำแหน่ง";

        if (!groupedPersons.has(position)) {
            groupedPersons.set(position, []);
        }

        groupedPersons.get(position).push(person);
    });

    groupedPersons.forEach((people, position) => {
        const heading = document.createElement("h3");

        heading.className = "position-heading";

        heading.textContent =
            `${getPositionLabel(position)} (${people.length} คน)`;

        container.appendChild(heading);

        people.forEach(person => {
            container.appendChild(
                createPersonItem(person, mode)
            );
        });
    });
}

/* RENDER PERSON LIST */

function renderModalPersons(data) {
    renderGroupedPersons(
        data,
        modalPersonList,
        "manage"
    );
}

/* SEARCH PERSON MODAL */

modalSearch.addEventListener("input", () => {
    const keyword = modalSearch.value.trim().toLowerCase();

    const filtered = persons.filter(person =>
        person.full_name.toLowerCase().includes(keyword) ||
        getPositionLabel(person.position).toLowerCase().includes(keyword)
    );

    renderModalPersons(filtered);
});

/* OPEN ADD PERSON FORM */

document.getElementById("openAddPerson").addEventListener("click", () => {
    addPersonForm.hidden = !addPersonForm.hidden;

    personMessage.textContent = "";

    if (!addPersonForm.hidden) {
        newPersonName.focus();
    }
});

/* CANCEL ADD PERSON */

document.getElementById("cancelAddPerson").addEventListener("click", () => {
    addPersonForm.hidden = true;

    newPersonName.value = "";
    newPersonPosition.value = "";

    personMessage.textContent = "";
});

/* ADD PERSON */

savePersonBtn.addEventListener("click", async () => {
    const fullName = newPersonName.value.trim();
    const position = newPersonPosition.value;

    if (!fullName) {
        personMessage.textContent = "กรุณากรอกชื่อบุคลากร";
        personMessage.style.color = "#dc2626";

        newPersonName.focus();

        return;
    }

    if (!position) {
        personMessage.textContent = "กรุณาเลือกตำแหน่ง";
        personMessage.style.color = "#dc2626";

        newPersonPosition.focus();

        return;
    }

    const duplicate = persons.some(person =>
        person.full_name.trim().toLowerCase() === fullName.toLowerCase()
    );

    if (duplicate) {
        personMessage.textContent = "มีชื่อบุคลากรนี้อยู่แล้ว";
        personMessage.style.color = "#dc2626";

        return;
    }

    savePersonBtn.disabled = true;
    savePersonBtn.textContent = "กำลังบันทึก...";

    const { error } = await supabase
        .from("persons")
        .insert({
            full_name: fullName,
            position: position
        });

    if (error) {
        personMessage.textContent =
            "เพิ่มบุคลากรไม่สำเร็จ: " + error.message;

        personMessage.style.color = "#dc2626";
    } else {
        personMessage.textContent = "เพิ่มบุคลากรสำเร็จ";

        personMessage.style.color = "#16a34a";

        newPersonName.value = "";
        newPersonPosition.value = "";

        await loadPersons();

        modalSearch.value = "";

        setTimeout(() => {
            addPersonForm.hidden = true;
            personMessage.textContent = "";
        }, 1000);
    }

    savePersonBtn.disabled = false;
    savePersonBtn.textContent = "บันทึก";
});

/* DELETE PERSON */

async function deletePerson(person) {
    const confirmed = confirm(
        `ต้องการลบ ${person.full_name} ใช่หรือไม่?`
    );

    if (!confirmed) return;

    const { count, error: checkError } = await supabase
        .from("leave_records")
        .select("*", {
            count: "exact",
            head: true
        })
        .eq("person_id", person.id);

    if (checkError) {
        alert("ตรวจสอบประวัติการลาไม่สำเร็จ: " + checkError.message);

        return;
    }

    if (count > 0) {
        alert(
            `ไม่สามารถลบ ${person.full_name} ได้\n\n` +
            `บุคลากรคนนี้มีประวัติการลาอยู่ ${count} รายการ\n\n` +
            `กรุณาจัดการประวัติการลาก่อน`
        );

        return;
    }

    const { error } = await supabase
        .from("persons")
        .delete()
        .eq("id", person.id);

    if (error) {
        alert("ลบบุคลากรไม่สำเร็จ: " + error.message);

        return;
    }

    if (Number(personId.value) === Number(person.id)) {
        personId.value = "";
        personSearch.value = "";
    }

    if (currentPerson?.id === person.id) {
        historySection.hidden = true;

        currentPerson = null;
        currentHistory = [];
    }

    alert("ลบบุคลากรสำเร็จ");

    await loadPersons();
}

/* OPEN HISTORY MODAL */

document.getElementById("openHistoryModal").addEventListener("click", () => {
    historySearchModal.hidden = false;

    historySearchInput.value = "";

    renderHistoryPersons(persons);

    document.body.style.overflow = "hidden";

    setTimeout(() => {
        historySearchInput.focus();
    }, 100);
});

/* CLOSE HISTORY MODAL */

function closeHistoryModal() {
    historySearchModal.hidden = true;

    document.body.style.overflow = "";
}

document.getElementById("closeHistoryModal").addEventListener(
    "click",
    closeHistoryModal
);

document.getElementById("closeHistoryBackdrop").addEventListener(
    "click",
    closeHistoryModal
);

/* RENDER HISTORY PERSONS */

function renderHistoryPersons(data) {
    renderGroupedPersons(
        data,
        historyPersonList,
        "history"
    );
}

/* SEARCH HISTORY PERSON */

historySearchInput.addEventListener("input", () => {
    const keyword = historySearchInput.value.trim().toLowerCase();

    const filtered = persons.filter(person =>
        person.full_name.toLowerCase().includes(keyword) ||
        getPositionLabel(person.position).toLowerCase().includes(keyword)
    );

    renderHistoryPersons(filtered);
});

/* SAVE LEAVE RECORD */

leaveForm.addEventListener("submit", async event => {
    event.preventDefault();

    calculateLeaveDays();

    if (!personId.value) {
        showMessage("กรุณาเลือกบุคลากรจากรายการค้นหา", false);

        personSearch.focus();

        return;
    }

    const selectedType = document.querySelector(
        'input[name="leaveType"]:checked'
    );

    if (!selectedType) {
        showMessage("กรุณาเลือกประเภทการลา", false);

        return;
    }

    if (!startDate.value || !endDate.value) {
        showMessage("กรุณาระบุวันที่เริ่มลาและวันที่สิ้นสุด", false);

        return;
    }

    if (endDate.value < startDate.value) {
        showMessage("วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา", false);

        return;
    }

    const payload = {
        person_id: Number(personId.value),
        start_date: startDate.value,
        end_date: endDate.value,
        leave_type: selectedType.value,
        days: Number(daysInput.value),
        reason: document.getElementById("reason").value.trim() || null
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "กำลังบันทึก...";

    const { error } = await supabase
        .from("leave_records")
        .insert(payload);

    if (error) {
        showMessage("บันทึกไม่สำเร็จ: " + error.message, false);
    } else {
        showMessage("บันทึกข้อมูลการลาสำเร็จ", true);

        const selectedPerson = persons.find(
            person => person.id === payload.person_id
        );

        leaveForm.reset();

        personId.value = "";
        personSearch.value = "";

        daysInput.value = "";

        personSuggestions.hidden = true;

        if (selectedPerson) {
            await loadPersonHistory(selectedPerson);
        }
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "บันทึกข้อมูลการลา";
});

/* LOAD PERSON HISTORY */

async function loadPersonHistory(person) {
    currentPerson = person;

    historySection.hidden = false;

    document.getElementById("historyName").textContent =
        `${person.full_name} (${getPositionLabel(person.position)})`;

    historyTable.innerHTML =
        '<tr><td colspan="6">กำลังโหลดข้อมูล...</td></tr>';

    document.getElementById("totalTimes").textContent = "0";
    document.getElementById("totalDays").textContent = "0";

    const { data, error } = await supabase
        .from("leave_records")
        .select("*")
        .eq("person_id", person.id)
        .order("start_date", { ascending: false });

    if (error) {
        currentHistory = [];

        historyTable.innerHTML =
            `<tr><td colspan="6">${error.message}</td></tr>`;

        return;
    }

    currentHistory = data || [];

    const totalDays = currentHistory.reduce(
        (total, record) => total + Number(record.days), 0
    );

    document.getElementById("totalTimes").textContent =
        currentHistory.length + " ครั้ง";

    document.getElementById("totalDays").textContent =
        totalDays + " วัน";

    historyTable.replaceChildren();

    if (currentHistory.length === 0) {
        historyTable.innerHTML =
            '<tr><td colspan="7" class="empty">ยังไม่มีประวัติการลา</td></tr>';
    } else {
        currentHistory.forEach(record => {
    const row = document.createElement("tr");

    const values = [
        formatDate(record.start_date),
        formatDate(record.end_date),
        record.leave_type,
        `${record.days} วัน`,
        record.reason || "-",
        formatDateTime(record.created_at)
    ];

    values.forEach(value => {
        const cell = document.createElement("td");

        cell.textContent = value;

        row.appendChild(cell);
    });

    const actionCell = document.createElement("td");

    const editBtn = document.createElement("button");

    editBtn.type = "button";
    editBtn.className = "btn-secondary";
    editBtn.textContent = "✏️ แก้ไข";

    editBtn.addEventListener("click", () => {
        openEditLeave(record);
    });

    const deleteBtn = document.createElement("button");

    deleteBtn.type = "button";
    deleteBtn.className = "person-delete-btn";
    deleteBtn.textContent = "🗑️ ลบ";

    deleteBtn.addEventListener("click", async () => {
        await deleteLeaveRecord(record);
    });

    actionCell.append(editBtn, deleteBtn);

    row.appendChild(actionCell);

    historyTable.appendChild(row);
});
}
}

/* DOWNLOAD INDIVIDUAL HISTORY */

document.getElementById("downloadHistory").addEventListener("click", () => {
    if (!currentPerson) {
        alert("ไม่พบข้อมูลบุคลากร");

        return;
    }

    if (currentHistory.length === 0) {
        alert("บุคลากรคนนี้ยังไม่มีประวัติการลา");

        return;
    }

    const totalDays = currentHistory.reduce(
        (total, record) => total + Number(record.days), 0
    );

    const summary = leaveTypes.map(type => {
        const records = currentHistory.filter(
            record => record.leave_type === type
        );

        const days = records.reduce(
            (total, record) => total + Number(record.days), 0
        );

        return [type, records.length, days];
    });

    const headers = [
        "ชื่อบุคลากร",
        "ตำแหน่ง",
        "วันที่เริ่มลา",
        "วันที่สิ้นสุด",
        "ประเภทการลา",
        "จำนวนวัน",
        "หมายเหตุ",
        "วันที่บันทึก"
    ];

    const rows = currentHistory.map(record => [
        currentPerson.full_name,
        getPositionLabel(currentPerson.position),
        formatDate(record.start_date),
        formatDate(record.end_date),
        record.leave_type,
        record.days,
        record.reason || "-",
        formatDateTime(record.created_at)
    ]);

    const csvRows = [
        ["รายงานประวัติการลา"],
        ["ชื่อบุคลากร", currentPerson.full_name],
        ["ตำแหน่ง", getPositionLabel(currentPerson.position)],
        [],
        ["สรุปประวัติการลา"],
        ["ประเภทการลา", "จำนวนครั้ง", "จำนวนวัน"],
        ...summary,
        ["รวมทั้งหมด", currentHistory.length, totalDays],
        [],
        ["รายละเอียดประวัติการลา"],
        headers,
        ...rows
    ];

    const today = new Date().toISOString().slice(0, 10);

    downloadCSV(
        csvRows,
        `ประวัติการลา_${currentPerson.full_name}_${today}.csv`
    );
});

/* DOWNLOAD ALL HISTORY - 6 MONTHS + POSITION + TOTAL */

const downloadAllHistoryBtn =
    document.getElementById("downloadAllHistory");

if (downloadAllHistoryBtn) {
    downloadAllHistoryBtn.addEventListener("click", async () => {
        const originalText = downloadAllHistoryBtn.textContent;

        downloadAllHistoryBtn.disabled = true;
        downloadAllHistoryBtn.textContent = "กำลังจัดทำรายงาน...";

        try {
            const allPersons = sortPersonsByPosition(
                await fetchAllRows(
                    "persons",
                    "id, full_name, position"
                )
            );

            const allRecords = await fetchAllRows(
                "leave_records",
                "*"
            );

            if (allPersons.length === 0) {
                alert("ยังไม่มีข้อมูลบุคลากร");

                return;
            }

            const records = allRecords.filter(record =>
                record.start_date &&
                record.end_date &&
                record.leave_type
            );

            /* GENERATE 6 MONTHS */

            /* GENERATE 6 MONTHS - CURRENT MONTH + PREVIOUS 5 MONTHS */

            const now = new Date();

            const months = [];

            for (let i = 5; i >= 0; i--) {
                const date = new Date(
                    now.getFullYear(),
                    now.getMonth() - i,
                    1
                );

                const year = date.getFullYear();
                const month = date.getMonth();

                const monthStart = dateFromUTC(
                    Date.UTC(year, month, 1)
                );

                const monthEnd = dateFromUTC(
                    Date.UTC(year, month + 1, 0)
                );

                months.push({
                    year,
                    month,
                    start: monthStart,
                    end: monthEnd,
                    name: `${thaiMonths[month]} ${year + 543}`
                });
            }

            /* REPORT HEADER */

            const csvRows = [];

            const firstHeader = [
                "ตำแหน่ง",
                "ชื่อบุคลากร"
            ];

            const secondHeader = [
                "",
                ""
            ];

            months.forEach(month => {
                firstHeader.push(
                    month.name,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    ""
                );

                secondHeader.push(
                    ...leaveTypes,
                    "รวมครั้ง",
                    "รวมวัน",
                    ""
                );
            });

            firstHeader.push(
                "สรุปรวม 6 เดือน",
                ""
            );

            secondHeader.push(
                "รวมครั้ง",
                "รวมวัน"
            );

            csvRows.push(firstHeader);
            csvRows.push(secondHeader);

            /* PERSON DATA */

            for (const person of allPersons) {
                const personRecords = records.filter(record =>
                    String(record.person_id) === String(person.id)
                );

                const row = [
                    getPositionLabel(person.position),
                    person.full_name
                ];

                let sixMonthTimes = 0;
                let sixMonthDays = 0;

                for (const month of months) {
                    const monthRecords = personRecords.filter(record => {
                        return (
                            record.start_date <= month.end &&
                            record.end_date >= month.start
                        );
                    });

                    /* COUNT BY LEAVE TYPE */

                    const typeCounts = leaveTypes.map(type => {
                        return monthRecords.filter(record => {
                            return (
                                record.leave_type === type &&
                                record.start_date >= month.start &&
                                record.start_date <= month.end
                            );
                        }).length;
                    });

                    /* TOTAL TIMES IN MONTH */

                    const totalTimes = monthRecords.filter(record => {
                        return (
                            record.start_date >= month.start &&
                            record.start_date <= month.end
                        );
                    }).length;

                    /* TOTAL OVERLAP DAYS IN MONTH */

                    const totalDays = monthRecords.reduce(
                        (total, record) => {
                            return total + getOverlapDays(
                                record.start_date,
                                record.end_date,
                                month.start,
                                month.end
                            );
                        },
                        0
                    );

                    row.push(
                        ...typeCounts,
                        totalTimes,
                        totalDays,
                        ""
                    );

                    sixMonthTimes += totalTimes;
                    sixMonthDays += totalDays;
                }

                /* SIX MONTH TOTAL */

                row.push(
                    sixMonthTimes,
                    sixMonthDays
                );

                csvRows.push(row);
            }

            /* DOWNLOAD */

            const today = new Date();

            const datePart =
                `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

            const filename =
                `รายงานการลาบุคลากร_6เดือน_${datePart}.csv`;

            downloadCSV(csvRows, filename);

        } catch (error) {
            console.error("Download all history error:", error);

            alert(
                "จัดทำรายงานไม่สำเร็จ: " + error.message
            );

        } finally {
            downloadAllHistoryBtn.disabled = false;
            downloadAllHistoryBtn.textContent = originalText;
        }
    });
}

/* CLOSE HISTORY */

document.getElementById("closeHistory").addEventListener("click", () => {
    historySection.hidden = true;

    currentPerson = null;
    currentHistory = [];
});

/* ESCAPE */

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (!personModal.hidden) {
            closePersonModal();
        }

        if (!historySearchModal.hidden) {
            closeHistoryModal();
        }
    }
});

/* START */
/* =========================================
   OPEN ALL HISTORY REPORT
========================================= */

const openAllHistoryBtn = document.getElementById("openAllHistoryModal");
const allHistoryModal = document.getElementById("allHistoryModal");
const closeAllHistoryBtn = document.getElementById("closeAllHistoryModal");
const closeAllHistoryBackdrop = document.getElementById("closeAllHistoryBackdrop");
const allHistoryTable = document.getElementById("allHistoryTable");
const allHistoryDate = document.getElementById("allHistoryDate");

async function renderAllHistoryReport() {
    const thead = allHistoryTable.querySelector("thead");
    const tbody = allHistoryTable.querySelector("tbody");

    thead.replaceChildren();
    tbody.replaceChildren();

    allHistoryDate.textContent = "กำลังโหลดข้อมูลรายงาน...";

    try {
        const allPersons = sortPersonsByPosition(
            await fetchAllRows(
                "persons",
                "id, full_name, position"
            )
        );

        const allRecords = await fetchAllRows(
            "leave_records",
            "*"
        );

        const records = allRecords.filter(record =>
            record.start_date &&
            record.end_date &&
            record.leave_type
        );

    const now = new Date();

    const months = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1
        );

        const year = date.getFullYear();
        const month = date.getMonth();

        const monthStart = dateFromUTC(
            Date.UTC(year, month, 1)
        );

        const monthEnd = dateFromUTC(
            Date.UTC(year, month + 1, 0)
        );

        months.push({
            year,
            month,
            start: monthStart,
            end: monthEnd,
            name: `${thaiMonths[month]} ${year + 543}`
        });
    }

        allHistoryDate.textContent =
            `รายงานข้อมูล ${months[0].name} ถึง ${months[5].name}`;

        /* TABLE HEADER */

        const firstHeader = document.createElement("tr");
        const secondHeader = document.createElement("tr");

        const positionHeader = document.createElement("th");
        positionHeader.textContent = "ตำแหน่ง";
        positionHeader.rowSpan = 2;

        const nameHeader = document.createElement("th");
        nameHeader.textContent = "ชื่อบุคลากร";
        nameHeader.rowSpan = 2;

        firstHeader.append(positionHeader, nameHeader);

        months.forEach(month => {
            const monthHeader = document.createElement("th");

            monthHeader.textContent = month.name;
            monthHeader.colSpan = 7;
            monthHeader.className = "month-group";

            firstHeader.appendChild(monthHeader);

            [
                ...leaveTypes,
                "รวมครั้ง",
                "รวมวัน"
            ].forEach((label, index) => {
                const th = document.createElement("th");

                th.textContent = label;

                if (index === 0) {
                    th.classList.add("month-sub");
                }

                secondHeader.appendChild(th);
            });
        });

        const totalTimesHeader = document.createElement("th");
        totalTimesHeader.textContent = "รวมครั้ง 6 เดือน";
        totalTimesHeader.rowSpan = 2;

        const totalDaysHeader = document.createElement("th");
        totalDaysHeader.textContent = "รวมวัน 6 เดือน";
        totalDaysHeader.rowSpan = 2;

        firstHeader.append(
            totalTimesHeader,
            totalDaysHeader
        );

        thead.append(firstHeader, secondHeader);

        /* NO PERSON DATA */

        if (allPersons.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 46;
            cell.textContent = "ยังไม่มีข้อมูลบุคลากร";
            cell.className = "empty";

            row.appendChild(cell);
            tbody.appendChild(row);

            return;
        }

        /* TOTAL SUMMARY */

        const monthlyTotals = months.map(() => ({
            typeCounts: leaveTypes.map(() => 0),
            times: 0,
            days: 0
        }));

        let grandTotalTimes = 0;
        let grandTotalDays = 0;

        /* PERSON ROWS */

        allPersons.forEach(person => {
            const personRecords = records.filter(record =>
                String(record.person_id) === String(person.id)
            );

            const row = document.createElement("tr");

            const positionCell = document.createElement("td");
            positionCell.textContent =
                getPositionLabel(person.position);

            const nameCell = document.createElement("td");
            nameCell.textContent = person.full_name;

            row.append(positionCell, nameCell);

            let personTotalTimes = 0;
            let personTotalDays = 0;

            months.forEach((month, monthIndex) => {
                const monthRecords = personRecords.filter(record =>
                    record.start_date >= month.start &&
                    record.start_date <= month.end
                );

                const typeCounts = leaveTypes.map(type =>
                    monthRecords.filter(record =>
                        record.leave_type === type
                    ).length
                );

                const totalTimes = monthRecords.length;

                const totalDays = personRecords.reduce(
                    (total, record) => {
                        return total + getOverlapDays(
                            record.start_date,
                            record.end_date,
                            month.start,
                            month.end
                        );
                    },
                    0
                );

                typeCounts.forEach((count, index) => {
                    const cell = document.createElement("td");

                    cell.textContent = count || "-";
                    row.appendChild(cell);

                    monthlyTotals[monthIndex].typeCounts[index] += count;
                });

                const timesCell = document.createElement("td");
                timesCell.textContent = totalTimes || "-";

                const daysCell = document.createElement("td");
                daysCell.textContent = totalDays || "-";

                row.append(timesCell, daysCell);

                monthlyTotals[monthIndex].times += totalTimes;
                monthlyTotals[monthIndex].days += totalDays;

                personTotalTimes += totalTimes;
                personTotalDays += totalDays;
            });

            const totalTimesCell = document.createElement("td");
            totalTimesCell.textContent = personTotalTimes;

            const totalDaysCell = document.createElement("td");
            totalDaysCell.textContent = personTotalDays;

            row.append(totalTimesCell, totalDaysCell);

            grandTotalTimes += personTotalTimes;
            grandTotalDays += personTotalDays;

            tbody.appendChild(row);
        });

        /* GRAND TOTAL ROW */

        const totalRow = document.createElement("tr");

        totalRow.className = "all-history-total-row";

        const totalLabel = document.createElement("td");
        totalLabel.textContent = "รวมทั้งหมด";
        totalLabel.colSpan = 2;

        totalRow.appendChild(totalLabel);

        monthlyTotals.forEach(monthTotal => {
            monthTotal.typeCounts.forEach(count => {
                const cell = document.createElement("td");

                cell.textContent = count;

                totalRow.appendChild(cell);
            });

            const timesCell = document.createElement("td");
            timesCell.textContent = monthTotal.times;

            const daysCell = document.createElement("td");
            daysCell.textContent = monthTotal.days;

            totalRow.append(timesCell, daysCell);
        });

        const grandTimesCell = document.createElement("td");
        grandTimesCell.textContent = grandTotalTimes;

        const grandDaysCell = document.createElement("td");
        grandDaysCell.textContent = grandTotalDays;

        totalRow.append(grandTimesCell, grandDaysCell);

        tbody.appendChild(totalRow);

    } catch (error) {
        console.error("Load all history report error:", error);

        allHistoryDate.textContent = "โหลดรายงานไม่สำเร็จ";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 46;
        cell.textContent = "เกิดข้อผิดพลาด: " + error.message;

        row.appendChild(cell);
        tbody.appendChild(row);
    }
}

/* OPEN REPORT */

openAllHistoryBtn.addEventListener("click", async () => {
    allHistoryModal.hidden = false;

    document.body.style.overflow = "hidden";

    await renderAllHistoryReport();
});

/* CLOSE REPORT */

function closeAllHistoryReport() {
    allHistoryModal.hidden = true;

    document.body.style.overflow = "";
}

closeAllHistoryBtn.addEventListener(
    "click",
    closeAllHistoryReport
);

closeAllHistoryBackdrop.addEventListener(
    "click",
    closeAllHistoryReport
);

/* CLOSE REPORT WITH ESCAPE */

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !allHistoryModal.hidden) {
        closeAllHistoryReport();
    }
});

/* =========================================
   EDIT & DELETE LEAVE RECORD
========================================= */

const editLeaveModal = document.getElementById("editLeaveModal");
const editLeaveForm = document.getElementById("editLeaveForm");

const editStartDate = document.getElementById("editStartDate");
const editEndDate = document.getElementById("editEndDate");
const editDays = document.getElementById("editDays");
const editLeaveType = document.getElementById("editLeaveType");
const editReason = document.getElementById("editReason");

const saveEditLeave = document.getElementById("saveEditLeave");
const editLeaveMessage = document.getElementById("editLeaveMessage");

let currentEditingLeaveId = null;

/* OPEN EDIT MODAL */

function openEditLeave(record) {
    currentEditingLeaveId = record.id;

    editStartDate.value = record.start_date;
    editEndDate.value = record.end_date;
    editDays.value = record.days;
    editLeaveType.value = record.leave_type;
    editReason.value = record.reason || "";

    editLeaveMessage.textContent = "";

    editStartDate.setCustomValidity("");
    editEndDate.setCustomValidity("");

    editLeaveModal.hidden = false;
    document.body.style.overflow = "hidden";
}

/* CLOSE EDIT MODAL */

function closeEditLeave() {
    editLeaveModal.hidden = true;

    document.body.style.overflow = "";

    currentEditingLeaveId = null;

    editLeaveForm.reset();

    editLeaveMessage.textContent = "";
}

document.getElementById("closeEditLeaveModal")
    .addEventListener("click", closeEditLeave);

document.getElementById("closeEditLeaveBackdrop")
    .addEventListener("click", closeEditLeave);

document.getElementById("cancelEditLeave")
    .addEventListener("click", closeEditLeave);

/* CALCULATE EDIT DAYS */

function calculateEditLeaveDays() {
    const start = editStartDate.value;
    const end = editEndDate.value;

    editEndDate.setCustomValidity("");

    if (!start || !end) {
        editDays.value = "";
        return;
    }

    if (end < start) {
        editDays.value = "";

        editEndDate.setCustomValidity(
            "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา"
        );

        return;
    }

    editDays.value = getDateRangeDays(start, end);
}

editStartDate.addEventListener(
    "change",
    calculateEditLeaveDays
);

editEndDate.addEventListener(
    "change",
    calculateEditLeaveDays
);

/* UPDATE LEAVE RECORD */

editLeaveForm.addEventListener("submit", async event => {
    event.preventDefault();

    calculateEditLeaveDays();

    const start = editStartDate.value;
    const end = editEndDate.value;

    if (!currentEditingLeaveId) {
        editLeaveMessage.textContent = "ไม่พบรายการที่ต้องการแก้ไข";
        return;
    }

    if (!start || !end || end < start) {
        editLeaveMessage.textContent = "กรุณาตรวจสอบวันที่ลา";
        editLeaveMessage.style.color = "#dc2626";
        return;
    }

    if (!editLeaveType.value) {
        editLeaveMessage.textContent = "กรุณาเลือกประเภทการลา";
        editLeaveMessage.style.color = "#dc2626";
        return;
    }

    const payload = {
        start_date: start,
        end_date: end,
        days: Number(editDays.value),
        leave_type: editLeaveType.value,
        reason: editReason.value.trim() || null
    };

    saveEditLeave.disabled = true;
    saveEditLeave.textContent = "กำลังบันทึก...";

    try {
        const { data, error } = await supabase
            .from("leave_records")
            .update(payload)
            .eq("id", currentEditingLeaveId)
            .select("id");

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error(
                "ไม่สามารถแก้ไขรายการได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงข้อมูล"
            );
        }

        const person = currentPerson;

        closeEditLeave();

        await loadPersonHistory(person);

        alert("แก้ไขข้อมูลการลาสำเร็จ");

    } catch (error) {
        console.error("Update leave error:", error);

        editLeaveMessage.textContent =
            "แก้ไขไม่สำเร็จ: " + error.message;

        editLeaveMessage.style.color = "#dc2626";

    } finally {
        saveEditLeave.disabled = false;
        saveEditLeave.textContent = "บันทึกการแก้ไข";
    }
});

/* DELETE LEAVE RECORD */

async function deleteLeaveRecord(record) {
    if (!currentPerson) {
        alert("ไม่พบข้อมูลบุคลากร");
        return;
    }

    const confirmed = confirm(
        `ต้องการลบประวัติการลานี้ใช่หรือไม่?\n\n` +
        `บุคลากร: ${currentPerson.full_name}\n` +
        `ประเภท: ${record.leave_type}\n` +
        `วันที่: ${formatDate(record.start_date)} - ${formatDate(record.end_date)}\n` +
        `จำนวน: ${record.days} วัน\n\n` +
        `การลบข้อมูลนี้ไม่สามารถย้อนกลับได้`
    );

    if (!confirmed) return;

    try {
        const { data, error } = await supabase
            .from("leave_records")
            .delete()
            .eq("id", record.id)
            .select("id");

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error(
                "ไม่พบรายการที่ต้องการลบ หรือไม่มีสิทธิ์ลบข้อมูล"
            );
        }

        await loadPersonHistory(currentPerson);

        alert("ลบประวัติการลาสำเร็จ");

    } catch (error) {
        console.error("Delete leave error:", error);

        alert(
            "ลบประวัติการลาไม่สำเร็จ: " + error.message
        );
    }
    
}

loadPersons();