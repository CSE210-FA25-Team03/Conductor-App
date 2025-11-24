# ADR: Selection of AWS as Primary Cloud Platform for the Conductor Tool

## 1. Context

The **Conductor Tool** is a large-scale academic support platform designed to help professors, TAs, tutors, team leaders, and students manage:

* communications
* scheduling
* evaluations and grading
* attendance tracking
* participation and queue management
* journals and reflections
* class-related workflows and documents

The system must:

* Support **500–1000 concurrent users** during peak academic sessions
* Store **tens of thousands of student records** across multiple course offerings
* Follow strict **security and privacy** requirements
* Maintain **high uptime** throughout 10-week course periods
* Support **Google OAuth** and potentially UCSD SSO in the future
* Handle **real-time or near-real-time interactions**
* Provide internationalization, accessibility, and mobile-friendly UX
* Minimize operational overhead for academic teams

The cloud platform must support:

* Managed authentication
* Managed relational databases
* Serverless or autoscaling runtime options
* Logging, monitoring, and alerting
* Secure storage and networking
* Straightforward CI/CD integration
* Low DevOps overhead


## 2. Decision

We will use **Amazon Web Services (AWS)** as the **primary cloud platform** for hosting all Conductor backend services, databases, static assets, and operational infrastructure.

**Team Members Involved:** Abhishek Dhaka, Boqi Zhu
**Date:** 11/18/2025

### Baseline Deployment Stack

* **AWS Elastic Beanstalk** or **ECS Fargate** for application hosting
* **AWS RDS (PostgreSQL)** for relational data
* **AWS S3** for static assets, documents, attachments, and ADR storage
* **AWS CloudWatch** for logging, monitoring, auditing, alerting
* **AWS API Gateway** for routing and serverless endpoints

This architecture minimizes operational overhead while providing scalability, security, and long-term maintainability.


## 3. Options Considered

### **Option A — Amazon Web Services (Selected)**

#### Pros

* Mature ecosystem with excellent documentation
* RDS PostgreSQL fits Conductor’s relational, role-based data model
* Wide range of serverless services (Lambda, SQS, SNS, EventBridge)
* CloudWatch + CloudTrail provide strong auditing — critical for student privacy
* S3 supports storage of documents, team assets, ADRs, rubrics, meeting minutes
* Proven capacity to support **1000+ concurrent users**
* Predictable pricing for our expected usage
* Team already has more AWS experience than alternative platforms

#### Cons

* Large ecosystem → some initial learning curve
* Requires understanding of IAM permissions

---

### **Option B — Google Cloud Platform (GCP)**

#### Pros

* Natural fit with Google OAuth
* Firebase simplifies real-time interactions
* Cleaner UI for beginners

#### Cons

* Firebase document model does not match our relational rubric/attendance/evaluation structures
* GCP is often **more expensive** for medium workloads
* Logging/auditing weaker than AWS CloudWatch/CloudTrail

#### Reason Rejected

Conductor handles **large relational data**, complex role-based access, and significant auditing needs.
AWS fits these requirements better than GCP.


## 4. Consequences

### Positive

* Long-term stable platform for a course offered quarterly
* Autoscaling handles peak class usage
* Built-in AWS auditing reduces security workload
* Easy GitHub Actions CI/CD integration
* Flexibility to use additional AWS services in the future
* Clear upgrade path for scaling beyond UCSD

### Negative

* Developers must understand IAM & AWS concepts
* Misconfigured services may increase costs


## 5. Technical Notes

* All audit logs (logins, role changes, data access) will be stored in **CloudWatch** and **CloudTrail**, with automated alarms for suspicious activity.
* The **Docs Manager** ADR generator will store Markdown files in **S3**, with syncing to GitHub via GitHub API.