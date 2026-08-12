import express, { Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./db";
import authRoutes from "./auth";
import {
  authenticate,
  AuthRequest,
  requireRole,
} from "./middleware/authMiddleware";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

// ==================== HOME ====================

app.get("/", (req, res) => {
  res.json({
    message: "Mini ERP + CRM API is running",
  });
});

// ==================== DATABASE HEALTH ====================

app.get("/api/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Database connected successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// ==================== GET CURRENT USER ====================

app.get(
  "/api/auth/me",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: req.user!.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error("Get profile error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to get user profile",
      });
    }
  }
);

// ==================== ADMIN TEST ====================

app.get(
  "/api/admin/test",
  authenticate,
  requireRole("ADMIN"),
  (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      message: "Admin access working",
      user: req.user,
    });
  }
);

// ==================== ADMIN DASHBOARD ====================

app.get(
  "/api/admin/dashboard",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [
        totalUsers,
        totalCustomers,
        totalProducts,
        totalChallans,
        pendingFollowUps,
      ] = await Promise.all([
        prisma.user.count(),

        prisma.customer.count(),

        prisma.product.count(),

        prisma.challan.count(),

        prisma.followUp.count({
          where: {
            status: "PENDING",
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          totalUsers,
          totalCustomers,
          totalProducts,
          totalChallans,
          pendingFollowUps,
        },
      });
    } catch (error) {
      console.error("Dashboard error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load dashboard",
      });
    }
  }
);

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

// ==================== CUSTOMER APIs ====================

// GET ALL CUSTOMERS
app.get(
  "/api/customers",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const customers = await prisma.customer.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json({
        success: true,
        customers,
      });
    } catch (error) {
      console.error("Get customers error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to get customers",
      });
    }
  }
);

// GET CUSTOMER BY ID
app.get(
  "/api/customers/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customer = await prisma.customer.findUnique({
        where: {
          id,
        },
        include: {
          followUps: true,
          challans: true,
        },
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      return res.json({
        success: true,
        customer,
      });
    } catch (error) {
      console.error("Get customer error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to get customer",
      });
    }
  }
);

// CREATE CUSTOMER
app.post(
  "/api/customers",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        company,
        email,
        phone,
        address,
        status,
      } = req.body;

      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          message: "Name and phone are required",
        });
      }

      const customer = await prisma.customer.create({
        data: {
          name,
          company,
          email,
          phone,
          address,
          status: status || "ACTIVE",
        },
      });

      return res.status(201).json({
        success: true,
        message: "Customer created successfully",
        customer,
      });
    } catch (error) {
      console.error("Create customer error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create customer",
      });
    }
  }
);

// UPDATE CUSTOMER
app.put(
  "/api/customers/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const {
        name,
        company,
        email,
        phone,
        address,
        status,
      } = req.body;

      const customer = await prisma.customer.update({
        where: {
          id,
        },
        data: {
          name,
          company,
          email,
          phone,
          address,
          status,
        },
      });

      return res.json({
        success: true,
        message: "Customer updated successfully",
        customer,
      });
    } catch (error) {
      console.error("Update customer error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update customer",
      });
    }
  }
);

// DELETE CUSTOMER
app.delete(
  "/api/customers/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      await prisma.customer.delete({
        where: {
          id,
        },
      });

      return res.json({
        success: true,
        message: "Customer deleted successfully",
      });
    } catch (error) {
      console.error("Delete customer error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete customer",
      });
    }
  }
);

// ==================== PRODUCT APIs ====================

// CREATE PRODUCT
app.post(
  "/api/products",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        sku,
        description,
        price,
        stock,
        minStock
      } = req.body;

      const product = await prisma.product.create({
        data: {
          name,
          sku,
          description,
          price,
          stock: stock ?? 0,
          minStock: minStock ?? 5
        }
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        product
      });
    } catch (error) {
      console.error("Create product error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create product"
      });
    }
  }
);

// GET ALL PRODUCTS
app.get(
  "/api/products",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const products = await prisma.product.findMany({
        orderBy: {
          id: "desc"
        }
      });

      res.json({
        success: true,
        products
      });
    } catch (error) {
      console.error("Get products error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to get products"
      });
    }
  }
);

// GET PRODUCT BY ID
app.get(
  "/api/products/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);

      const product = await prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      res.json({
        success: true,
        product
      });
    } catch (error) {
      console.error("Get product error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to get product"
      });
    }
  }
);

// UPDATE PRODUCT
app.put(
  "/api/products/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);

      const product = await prisma.product.update({
        where: { id },
        data: req.body
      });

      res.json({
        success: true,
        message: "Product updated successfully",
        product
      });
    } catch (error) {
      console.error("Update product error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update product"
      });
    }
  }
);

// DELETE PRODUCT
app.delete(
  "/api/products/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);

      await prisma.product.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: "Product deleted successfully"
      });
    } catch (error) {
      console.error("Delete product error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete product"
      });
    }
  }
);

// ==================== STOCK MOVEMENT APIs ====================

// CREATE STOCK MOVEMENT
app.post(
  "/api/stock-movements",
  authenticate,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { productId, quantity, type, reference } = req.body;

      if (!productId || !quantity || !type) {
        return res.status(400).json({
          success: false,
          message: "productId, quantity and type are required"
        });
      }

      if (!["IN", "OUT"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "type must be IN or OUT"
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: Number(productId) }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      const newStock =
        type === "IN"
          ? product.stock + Number(quantity)
          : product.stock - Number(quantity);

      if (newStock < 0) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock"
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const movement = await tx.stockMovement.create({
          data: {
            productId: Number(productId),
            quantity: Number(quantity),
            type,
            reference
          }
        });

        const updatedProduct = await tx.product.update({
          where: { id: Number(productId) },
          data: {
            stock: newStock
          }
        });

        return { movement, updatedProduct };
      });

      res.status(201).json({
        success: true,
        message: "Stock movement created successfully",
        movement: result.movement,
        product: result.updatedProduct
      });

    } catch (error) {
      console.error("Stock movement error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create stock movement"
      });
    }
  }
);

// GET STOCK MOVEMENTS
app.get(
  "/api/stock-movements",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const movements = await prisma.stockMovement.findMany({
        include: {
          product: true
        },
        orderBy: {
          id: "desc"
        }
      });

      res.json({
        success: true,
        movements
      });

    } catch (error) {
      console.error("Get stock movements error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to get stock movements"
      });
    }
  }
);

// ==================== FOLLOW-UP APIs ====================

// CREATE FOLLOW-UP
app.post(
  "/api/follow-ups",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { customerId, date, notes, status } = req.body;

      if (!customerId || !date || !notes) {
        return res.status(400).json({
          success: false,
          message: "customerId, date and notes are required"
        });
      }

      const customer = await prisma.customer.findUnique({
        where: {
          id: Number(customerId)
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found"
        });
      }

      const followUp = await prisma.followUp.create({
        data: {
          customerId: Number(customerId),
          userId: req.user!.id,
          date: new Date(date),
          notes,
          status: status || "PENDING"
        }
      });

      return res.status(201).json({
        success: true,
        message: "Follow-up created successfully",
        followUp
      });

    } catch (error) {
      console.error("Create follow-up error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create follow-up"
      });
    }
  }
);

// GET FOLLOW-UPS
app.get(
  "/api/follow-ups",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const followUps = await prisma.followUp.findMany({
        include: {
          customer: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          date: "asc"
        }
      });

      return res.json({
        success: true,
        followUps
      });

    } catch (error) {
      console.error("Get follow-ups error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to get follow-ups"
      });
    }
  }
);

// ==================== CHALLAN APIs ====================

// CREATE CHALLAN
app.post(
  "/api/challans",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        challanNo,
        customerId,
        items,
        status
      } = req.body;

      if (!challanNo || !customerId || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "challanNo, customerId and items are required"
        });
      }

      const customer = await prisma.customer.findUnique({
        where: {
          id: Number(customerId)
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found"
        });
      }

      let totalAmount = 0;

      const challanItems = items.map((item: any) => {
        const quantity = Number(item.quantity);
        const price = Number(item.price);

        totalAmount += quantity * price;

        return {
          productId: Number(item.productId),
          quantity,
          price
        };
      });

      const challan = await prisma.challan.create({
        data: {
          challanNo,
          customerId: Number(customerId),
          status: status || "DRAFT",
          totalAmount,
          items: {
            create: challanItems
          }
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      return res.status(201).json({
        success: true,
        message: "Challan created successfully",
        challan
      });

    } catch (error) {
      console.error("Create challan error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create challan"
      });
    }
  }
);

// GET ALL CHALLANS
app.get(
  "/api/challans",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const challans = await prisma.challan.findMany({
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: {
          id: "desc"
        }
      });

      return res.json({
        success: true,
        challans
      });

    } catch (error) {
      console.error("Get challans error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to get challans"
      });
    }
  }
);


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});