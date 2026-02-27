import { sendEmail } from "../utils/sendEmail.js";
import { supabase } from "../config/supabase.js";

/* ========================================
   Allowed Modules
======================================== */
const allowedModules = [
  "merchant_onboarding",
  "payments",
  "authentication",
  "inventory",
  "orders",
  "reports",
  "kyc",
  "settlement",
  "customer_portal",
];

/* ========================================
   CREATE TICKET (ADMIN / SUPPORT)
======================================== */
export const createNewTicket = async (req, res) => {
  try {
    const { module, reference_id, title, description, priority } = req.body;

    if (!module || !allowedModules.includes(module)) {
      return res.status(400).json({ message: "Invalid module" });
    }

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description required" });
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert([
        {
          module,
          reference_id,
          title,
          description,
          priority: priority || "medium",
          status: "open",
          created_by: req.user.id,
          assigned_to: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error("Admin ticket error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ========================================
   CREATE TICKET (MERCHANT + EMAIL)
======================================== */


export const createMerchantTicket = async (req, res) => {
  try {
    const { merchant_id,module, title, description } = req.body;

    if (!merchant_id || !title || !description) {
      return res.status(400).json({
        message: "merchant_id, title and description required",
      });
    }

    // 1️⃣ Insert ticket
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert([
        {
         // module: "merchant_onboarding",
         module,
         title,
          description,
          priority: "medium",
          status: "open",
          created_by: merchant_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // 2️⃣ Get merchant email from merchant_profiles
    const { data: merchant, error: merchantError } = await supabase
      .from("merchant_profiles")
      .select("email, full_name")
      .eq("user_id", merchant_id)
      .single();

    if (merchantError) {
      console.error("Merchant fetch error:", merchantError);
    }

    // 3️⃣ Send email
    if (merchant?.email) {
    await sendEmail(
  merchant.email,
  "🎫 Your Support Ticket Has Been Created - SabbPe",
  `
  <div style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 0;">
          
          <!-- Main Card -->
          <table width="600" cellpadding="0" cellspacing="0" 
            style="background:#ffffff;border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,0.08);overflow:hidden;">
            
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(90deg,#4f46e5,#7c3aed);padding:20px 30px;color:#ffffff;">
                <h2 style="margin:0;">SabbPe Support</h2>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px;">
                <h3 style="margin-top:0;color:#333;">Hello ${merchant.full_name || "Merchant"},</h3>
                
                <p style="color:#555;font-size:15px;">
                  Your support ticket has been successfully created.
                  Our team will review your issue and respond shortly.
                </p>

                <!-- Ticket Box -->
                <div style="margin:20px 0;padding:20px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;">
                  <p style="margin:5px 0;"><strong>Ticket ID:</strong> ${ticket.id}</p>
                  <p style="margin:5px 0;"><strong>Title:</strong> ${ticket.title}</p>
                  <p style="margin:5px 0;"><strong>Status:</strong> 
                    <span style="color:#4f46e5;font-weight:bold;">OPEN</span>
                  </p>
                </div>

                <p style="color:#555;font-size:14px;">
                  You will receive updates whenever the status changes.
                </p>

                <!-- CTA Button -->
                <div style="margin-top:25px;text-align:center;">
                  <a href="https://your-merchant-portal-link.com"
                     style="display:inline-block;padding:12px 24px;
                            background:linear-gradient(90deg,#4f46e5,#7c3aed);
                            color:#ffffff;text-decoration:none;
                            border-radius:6px;font-weight:bold;">
                    View My Tickets
                  </a>
                </div>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#777;">
                © ${new Date().getFullYear()} SabbPe. All rights reserved.<br/>
                This is an automated email. Please do not reply.
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </div>
  `
);

      console.log("📧 Email sent to merchant:", merchant.email);
    } else {
      console.log("⚠ Merchant email not found");
    }

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ message: error.message });
  }
};


/* ========================================
   GET TICKETS (Role Based)
======================================== */
export const getTickets = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const { page = 1, limit = 10, status, module } = req.query;

    let query = supabase
      .from("tickets")
      .select("*", { count: "exact" });

    // Support users see only assigned tickets
    if (!(userRole === "super_admin" || userRole === "admin")) {
      query = query.eq("assigned_to", userId);
    }

    if (status) query = query.eq("status", status);
    if (module) query = query.eq("module", module);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .range(from, to)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 🔥 Add last message info for notification
    const ticketsWithMessages = await Promise.all(
      data.map(async (ticket) => {
        const { data: lastMessage } = await supabase
          .from("ticket_messages")
          .select("sender_role, created_at")
          .eq("ticket_id", ticket.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...ticket,
          last_message_role: lastMessage?.sender_role || null,
          last_message_at: lastMessage?.created_at || null,
        };
      })
    );

    res.json({
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
      tickets: ticketsWithMessages,
    });
  } catch (error) {
    console.error("Get tickets error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ========================================
   ASSIGN TICKET
======================================== */
export const assignTicket = async (req, res) => {
  try {
    const { ticketId, userId } = req.body;

    const { data, error } = await supabase
      .from("tickets")
      .update({
        assigned_to: userId,
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ========================================
   UPDATE STATUS (STRICT WORKFLOW + EMAIL)
======================================== */


export const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId, status } = req.body;

    if (!ticketId || !status) {
      return res.status(400).json({ message: "ticketId and status are required" });
    }

    const { data: ticket, error: fetchError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (fetchError || !ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const role = req.user.role;

    // ✅ Lifecycle rules
    const allowedTransitions = {
      open: ["assigned"],
      assigned: ["in_progress"],
      in_progress: ["resolved"],
      resolved: ["closed"],
      closed: [],
    };

    if (!allowedTransitions[ticket.status]?.includes(status)) {
      return res.status(400).json({
        message: `Invalid transition from ${ticket.status} to ${status}`,
      });
    }

    // ✅ Role restrictions
    if (status === "in_progress" && role !== "support") {
      return res.status(403).json({ message: "Only support can start work" });
    }

    if (status === "resolved" && role !== "support") {
      return res.status(403).json({ message: "Only support can resolve" });
    }

    if (status === "closed" && role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ message: "Only admin can close ticket" });
    }

    const { data: updated, error } = await supabase
      .from("tickets")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select()
      .single();
      
      
      

    if (error) throw error;
  

    res.json(updated);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
/* ========================================
   DASHBOARD STATS
======================================== */
export const getTicketStats = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tickets")
      .select("status");

    if (error) throw error;

    const stats = {
      total: data.length,
      open: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      waiting_customer: 0,
      closed: 0,
    };

    data.forEach((ticket) => {
      stats[ticket.status]++;
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
/* ========================================
   TEST EMAIL
======================================== */
export const testEmail = async (req, res) => {
  const result = await sendEmail(
    process.env.EMAIL_USER,
    "Test Email From SabbPe",
    "<h1>Email system working</h1>"
  );

  if (result) {
    res.send("Email sent successfully");
  } else {
    res.send("Email failed");
  }
};

/* ========================================
   GET MERCHANT TICKETS
======================================== */
export const getMerchantTickets = async (req, res) => {
  try {
    const { merchant_id } = req.params;

    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("created_by", merchant_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// ============================================
// GET MERCHANT REVIEW DETAILS
// ============================================
export const getMerchantReviewDetails = async (req, res) => {
  try {
    const { merchant_id } = req.params;

    const { data, error } = await supabase
      .from("merchant_profiles")
      .select("*")
      .eq("user_id", merchant_id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ============================================
// APPROVE / REJECT MERCHANT
// ============================================
export const reviewMerchant = async (req, res) => {
  try {
    const { merchant_id, status, review_notes } = req.body;

    if (!merchant_id || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    /* ==============================
       1️⃣ Get Merchant Profile
    =============================== */
    const { data: profile, error: profileError } = await supabase
      .from("merchant_profiles")
      .select("*")
      .eq("user_id", merchant_id)
      .single();

    if (profileError) throw profileError;
    if (!profile) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    /* ==============================
       2️⃣ Update Merchant Profile
    =============================== */
 
const { error: updateError } = await supabase
  .from("merchant_profiles")
  .update({
    onboarding_status: status,   // 👈 VERY IMPORTANT
    rejection_reason: status === "rejected" ? review_notes : null,
    reviewed_by: req.user.id,
    reviewed_at: new Date().toISOString(),
  })
  .eq("user_id", merchant_id);
    if (updateError) throw updateError;

    /* ==============================
       3️⃣ Update Onboarding Ticket (If Exists)
    =============================== */
    const { data: tickets, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("created_by", merchant_id)
      .eq("module", "merchant_onboarding")
      .order("created_at", { ascending: false })
      .limit(1);

    if (ticketError) throw ticketError;

    if (tickets && tickets.length > 0) {
      const onboardingTicket = tickets[0];

      const newStatus =
        status === "approved" ? "closed" : "waiting_customer";

      await supabase
        .from("tickets")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", onboardingTicket.id);

      console.log("✅ Onboarding ticket updated");
    } else {
      console.log("⚠ No onboarding ticket found, skipping ticket update");
    }

    /* ==============================
       4️⃣ Send Email Notification
    =============================== */
    const subject =
      status === "approved"
        ? "🎉 Your Merchant Account Has Been Approved - SabbPe"
        : "❌ Merchant Account Review Update - SabbPe";

    const message =
      status === "approved"
        ? `
     <div style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 0;">

          <table width="600" cellpadding="0" cellspacing="0"
            style="background:#ffffff;border-radius:12px;
                   box-shadow:0 8px 20px rgba(0,0,0,0.08);overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(90deg,#16a34a,#22c55e);
                         padding:20px 30px;color:#ffffff;">
                <h2 style="margin:0;">SabbPe Merchant Approval</h2>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px;">
                <h3 style="margin-top:0;color:#333;">
                  Congratulations ${profile.full_name || "Merchant"}!
                </h3>

                <p style="color:#555;font-size:15px;">
                  Your merchant account has been successfully approved.
                  You can now access all SabbPe merchant features.
                </p>

                <div style="margin:20px 0;padding:20px;
                            background:#ecfdf5;border-radius:10px;
                            border:1px solid #bbf7d0;">
                  <p style="margin:5px 0;">
                    <strong>Status:</strong>
                    <span style="color:#16a34a;font-weight:bold;">
                      APPROVED
                    </span>
                  </p>
                  <p style="margin:5px 0;">
                    <strong>Business:</strong> ${profile.business_name}
                  </p>
                </div>

             
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f3f4f6;padding:20px;text-align:center;
                         font-size:12px;color:#777;">
                © ${new Date().getFullYear()} SabbPe. All rights reserved.<br/>
                This is an automated message. Please do not reply.
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </div>
  `
    : `
  <div style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 0;">

          <table width="600" cellpadding="0" cellspacing="0"
            style="background:#ffffff;border-radius:12px;
                   box-shadow:0 8px 20px rgba(0,0,0,0.08);overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(90deg,#dc2626,#ef4444);
                         padding:20px 30px;color:#ffffff;">
                <h2 style="margin:0;">SabbPe Merchant Review</h2>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px;">
                <h3 style="margin-top:0;color:#333;">
                  Hello ${profile.full_name || "Merchant"},
                </h3>

                <p style="color:#555;font-size:15px;">
                  After reviewing your submission, we regret to inform you
                  that your merchant account has not been approved.
                </p>

                <div style="margin:20px 0;padding:20px;
                            background:#fef2f2;border-radius:10px;
                            border:1px solid #fecaca;">
                  <p style="margin:5px 0;">
                    <strong>Status:</strong>
                    <span style="color:#dc2626;font-weight:bold;">
                      REJECTED
                    </span>
                  </p>
                  <p style="margin:5px 0;">
                    <strong>Reason:</strong>
                    ${review_notes || "Not specified"}
                  </p>
                </div>

                <p style="color:#555;font-size:14px;">
                  You may update your documents and resubmit for review.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f3f4f6;padding:20px;text-align:center;
                         font-size:12px;color:#777;">
                © ${new Date().getFullYear()} SabbPe. All rights reserved.<br/>
                This is an automated message. Please do not reply.
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </div>
        `;

    if (profile.email) {
      await sendEmail(profile.email, subject, message);
      console.log("📧 Email sent to:", profile.email);
    }

    /* ==============================
       5️⃣ Final Response
    =============================== */
    res.json({ message: `Merchant ${status} successfully` });

  } catch (error) {
    console.error("Review error:", error);
    res.status(500).json({ message: error.message });
  }
};



export const getMerchantReviewData = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ message: "Merchant ID required" });
    }

    // 🔐 Support access check
    if (req.user.role === "support") {
      const { data: tickets, error: ticketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("created_by", merchantId)
        .eq("assigned_to", req.user.id)
        .eq("module", "merchant_onboarding")
        .limit(1);

      if (ticketError) throw ticketError;

      if (!tickets || tickets.length === 0) {
        return res.status(403).json({
          message: "You are not authorized to view this merchant",
        });
      }
    }

    // ✅ 1️⃣ Get merchant profile (SAFE VERSION)
    const { data: profile, error: profileError } = await supabase
      .from("merchant_profiles")
      .select("*")
      .eq("user_id", merchantId)
      .maybeSingle();   // 🔥 IMPORTANT CHANGE

    if (profileError) throw profileError;

    if (!profile) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // ✅ 2️⃣ Get documents safely
    const { data: documents, error: docsError } = await supabase
      .from("merchant_documents")
      .select("*")
      .eq("merchant_id", profile.id);

    if (docsError) throw docsError;

    const documentsWithUrls = (documents || []).map((doc) => {
      const { data } = supabase.storage
        .from("merchant-documents")
        .getPublicUrl(doc.file_path);

      return {
        ...doc,
        public_url: data?.publicUrl || null,
      };
    });

    res.json({
      profile,
      documents: documentsWithUrls,
    });

  } catch (error) {
    console.error("Merchant review fetch error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getTicketMessages = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const { data, error } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const sendTicketMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;

    const { data, error } = await supabase
      .from("ticket_messages")
      .insert([
        {
          ticket_id: ticketId,
          sender_id: req.user.id,
          sender_role: req.user.role,
          message,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getKYCList = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("merchant_profiles")
      .select("id, user_id, full_name, email, approval_status")  // <-- ADD user_id
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.json(data);

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
export const getAssignedKYCForSupport = async (req, res) => {
  try {
    const supportId = req.user.id;

    // 1️⃣ Get assigned onboarding tickets
    const { data: tickets, error: ticketError } = await supabase
      .from("tickets")
      .select("created_by")
      .eq("module", "merchant_onboarding")
      .eq("assigned_to", supportId);

    if (ticketError) throw ticketError;

    if (!tickets || tickets.length === 0) {
      return res.json([]);
    }

    // 2️⃣ Extract merchant IDs
    const merchantIds = tickets.map((t) => t.created_by);

    // 3️⃣ Fetch merchant profiles
    const { data: merchants, error: merchantError } = await supabase
      .from("merchant_profiles")
      .select("id, user_id, full_name, email, approval_status")
      .in("user_id", merchantIds);

    if (merchantError) throw merchantError;

    res.json(merchants);

  } catch (error) {
    console.error("Assigned KYC error:", error);
    res.status(500).json({ message: error.message });
  }
};