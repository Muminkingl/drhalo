## New Feature Request: Appointment Scheduling System for Staff & Admin

Please review the existing codebase and fully understand the current architecture before making any changes.

### Current Situation

We currently have two user roles:

1. **Admin (Doctor)**
2. **Staff**

At the moment, staff users can only access:

`/dashboard/patient-form`

This form is currently being used for both actual patient registrations and appointment tracking, which is not ideal.

---

## Required Changes

### 1. Create a New Route

Add a new route:

`/dashboard/schedule`

This page will be used by staff members to manage patient appointments before the patient actually arrives at the clinic.

---

### 2. Staff Appointment Workflow

Example:

A patient calls the clinic and says:

> "I will come to the clinic at 10:00 PM."

The staff should **NOT** create a patient record immediately in `/dashboard/patient-form`.

Instead, they should create an appointment in:

`/dashboard/schedule`

The appointment should contain information such as:

* Patient Name
* Phone Number
* Appointment Date
* Appointment Time
* Notes (optional)
* Appointment Status

Suggested statuses:

* Scheduled
* Arrived
* Completed
* Cancelled

---

### 3. Patient Registration Workflow

When the patient physically arrives at the clinic:

* Staff opens the appointment.
* Staff marks the appointment as "Arrived".
* Staff then creates the actual patient record in `/dashboard/patient-form`.

In other words:

**Schedule = Future appointments**

**Patient Form = Patients who have actually arrived and are being registered**

---

### 4. Admin / Doctor Dashboard

The Admin (Doctor) should have access to all scheduled appointments.

Requirements:

* Clean and modern UI
* Easy-to-read appointment list
* Clear status indicators
* Search functionality
* Filter by status
* Filter by date
* Upcoming appointments section
* Today's appointments section
* Responsive design

The goal is for the doctor to quickly understand:

* Who is coming today
* Who is scheduled next
* Who has arrived
* Who cancelled

The UI should be professional, polished, and optimized for daily clinic usage.

---

## Important

Do not break the existing patient registration workflow.

The new scheduling system should be added as a separate feature that integrates smoothly with the current system.

Before implementation, analyze the existing codebase structure, routing, authentication, role permissions, and database models to determine the best architecture for this feature.
