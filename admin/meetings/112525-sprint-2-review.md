## Sprint 2 review

**Attendees:** Abshiek, Yuting, Gabrielle, Andrew, Hanis, Bobby, and Rui  
**Location:** Grad housing  
---

**What we discussed:**
- Went over the entire workflow of the conductor app
- Clarified the wireframe for each feature
- Clarified features that need to be done for MVP:
  - **User Manager / Authentication / Roles**
    - Logging should happen on login / logout, access of private data, and we should have at least basic alerting on excessive login fail attempts and such.
  - **Class directory**
    - Activity (punch card style with a pull down)  
      - Attendance  
  - **Attendance System**
    - Should allow updates  
    - Need attendance for meetings  
    - Team-based overview with % and class overview and plot it over time  
      - Attendance rate  
        - Ex. Nov 2nd, 70%; Nov 4th, 80%...
  - **Work journals**
    - Automated bot in email or chat (ASK TA)

---


**What we accomplished:**
- Finished skeletons for all the wireframes  
- Finished frontend for task tracker, team cards, work journal, group formation, evaluation journal, class directory  
- Finished CI/CD

---
**Goals for next sprint:**
- Features for attendence system (front end + backend)
  - Quick entry system to show who is here and who isn’t in lecture; should be something that can be done on a phone in ~1 minute
  - Should allow updates
  - Could do both lecture and arbitrary meetings
  - We should get a team-based overview with % and an overall class overview and plot it over time

- Work Journal / Stand-Up Tool
  - Be able to write down what you have done 
  - Express emotional sentiment about themselves, the team, the course
  - Reach out to the team leader, TA, or Prof
  - Perform these activities easily and often
  - Go into the repo directly
  - Automated bot in email or chat (need to evaluate how that is done)
- Login and authentication
- Mobile responsiveness

