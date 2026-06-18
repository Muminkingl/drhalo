## Schedule & Patient Management Fixes

Please review and implement the following improvements.

---

# 1. Add Gender Field to Schedule Appointments

Route:

`/dashboard/schedule`

When creating a new appointment, add a new required field:

* Gender

Options:

* Male
* Female

This information should be stored together with the appointment and remain available throughout the patient workflow.

---

# 2. Automatically Create Patient Record When Appointment Status = Arrived

Current Problem:

When a staff member creates an appointment in:

`/dashboard/schedule`

and later changes the appointment status to:

`Arrived`

the system currently requires the staff member to manually open:

`/dashboard/patients`

or

`/dashboard/patient-form`

and register the patient again.

This creates duplicate work and slows down reception staff.

---

## Required Behavior

When an appointment status is changed to:

`Arrived`

the system should automatically:

1. Create a patient record.
2. Transfer all available appointment data into the patient record.
3. Add the patient to `/dashboard/patients`.
4. Mark the appointment as converted/processed.
5. Prevent duplicate patient creation.

Data that should transfer automatically:

* Patient Name
* Phone Number
* Gender
* Age
* Appointment Date
* Notes
* Any other relevant fields

The staff should NOT have to register the same patient twice.

---

# 3. Patient Details Panel Missing Age

Route:

`/dashboard/patients`

Current Problem:

When selecting a patient from the patients list, the details panel on the right side displays patient information.

However, the patient's Age is missing.

The age is already collected during patient registration, but it is not displayed in the patient details view.

---

## Required Fix

Display the patient's Age in the patient details panel alongside other patient information.

Example:

* Name
* Age
* Gender
* Phone Number
* Clinic ID
* Registration Date
* Notes

Ensure the age is loaded correctly from the database and displayed consistently for all patients.

---
# 4. Allow Editing Patient Information

Route:

`/dashboard/patients`

Current Problem:

When selecting a patient from the patients list, the details panel on the right side only displays the patient's information.

If the staff accidentally enters the wrong patient name, there is currently no easy way to correct it.

---

# 4. Filter in `/dashboard/patients`

in that route add a filter that shows todays patent or yester or custom date use clean ui b, and also whe n this page rendered it should by default shows todays date 