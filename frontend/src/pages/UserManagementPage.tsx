import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Select,
  Typography,
  App,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { usersApi, rolesApi } from '../api/services';
import type { UserInfo, RoleInfo } from '../types/api';
import dayjs from 'dayjs';

const { Title } = Typography;

/**
 * User Management Page Component
 * Admin-only page for managing users
 */

const UserManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [rolesModalVisible, setRolesModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [userRoles, setUserRoles] = useState<number[]>([]);
  const [form] = Form.useForm();
  const [rolesForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);


  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await usersApi.getAll();
      setUsers(response.data);
    } catch (error: any) {
      messageApi.error('Failed to load users: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await rolesApi.getAll();
      setRoles(response.data);
    } catch (error: any) {
      messageApi.error('Failed to load roles: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (user: UserInfo) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isActive: user.isActive,
    });
    setModalVisible(true);
  };

  const handleManageRoles = async (user: UserInfo) => {
    console.log('📋 handleManageRoles called for user:', user.username);
    setSelectedUser(user);
    setRolesLoading(true);

    try {
      // Load the user's roles BEFORE opening modal
      const response = await usersApi.getRoles(user.id);
      const userRoleIds = response.data.map((item) => item.role.id);
      console.log('✅ User roles loaded:', userRoleIds, 'for user:', user.username);

      // Set the roles in state
      setUserRoles(userRoleIds);

      // Set form initial values
      rolesForm.setFieldsValue({ roleIds: userRoleIds });

      // Now open modal with data ready
      console.log('🚪 Opening modal with values:', userRoleIds);
      setRolesModalVisible(true);
    } catch (error: any) {
      messageApi.error('Failed to load user roles: ' + (error.response?.data?.message || error.message));
    } finally {
      setRolesLoading(false);
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (editingUser) {
        // Update user
        await usersApi.update(editingUser.id, values);
        messageApi.success('User updated successfully');
      } else {
        // Create user
        await usersApi.create(values);
        messageApi.success('User created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error: any) {
      if (error.response) {
        messageApi.error('Operation failed: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleRolesModalOk = async () => {
    if (!selectedUser) return;

    try {
      const values = await rolesForm.validateFields();
      await usersApi.assignRoles(selectedUser.id, {
        roleIds: values.roleIds || [],
      });
      messageApi.success('User roles updated successfully');
      setRolesModalVisible(false);
      rolesForm.resetFields();
    } catch (error: any) {
      messageApi.error('Failed to update roles: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (user: UserInfo) => {
    try {
      await usersApi.remove(user.id);
      messageApi.success('User deactivated successfully');
      fetchUsers();
    } catch (error: any) {
      messageApi.error('Failed to deactivate user: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleResetPassword = (user: UserInfo) => {
    setSelectedUser(user);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  const handlePasswordModalOk = async () => {
    if (!selectedUser) return;

    try {
      const values = await passwordForm.validateFields();
      await usersApi.resetPassword(selectedUser.id, {
        newPassword: values.newPassword,
      });
      messageApi.success(`Password reset successfully for user "${selectedUser.username}"`);
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      messageApi.error('Failed to reset password: ' + (error.response?.data?.message || error.message));
    }
  };

  const columns: ColumnsType<UserInfo> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email) => email || '-',
    },
    {
      title: 'Admin',
      dataIndex: 'isAdmin',
      key: 'isAdmin',
      width: 100,
      render: (isAdmin: boolean) => (
        <Tag color={isAdmin ? 'gold' : 'default'}>
          {isAdmin ? 'Admin' : 'User'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            type="link"
            size="small"
            icon={<TeamOutlined />}
            onClick={() => handleManageRoles(record)}
          >
            Roles
          </Button>
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            Reset Pwd
          </Button>
          {record.isActive && (
            <Popconfirm
              title="Deactivate this user?"
              onConfirm={() => handleDelete(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                Deactivate
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
      >
        <Title level={4} style={{ margin: 0 }}>
          User Management
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          Create User
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ showSizeChanger: true, showTotal: (total) => `Total ${total} users` }}
      />

      <Modal
        title={editingUser ? 'Edit User' : 'Create User'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        okText={editingUser ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Username"
            name="username"
            rules={[
              { required: true, message: 'Please input username!' },
              { min: 3, message: 'Username must be at least 3 characters' },
            ]}
          >
            <Input disabled={!!editingUser} />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: 'Please input password!' },
                { min: 6, message: 'Password must be at least 6 characters' },
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}

          <Form.Item
            label="Email"
            name="email"
            rules={[{ type: 'email', message: 'Please input valid email!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Admin" name="isAdmin" valuePropName="checked">
            <Switch />
          </Form.Item>

          {editingUser && (
            <Form.Item label="Active" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={`Manage Roles for ${selectedUser?.username}`}
        open={rolesModalVisible}
        onOk={handleRolesModalOk}
        onCancel={() => {
          setRolesModalVisible(false);
          rolesForm.resetFields();
          setUserRoles([]);
        }}
        okText="Update"
        confirmLoading={rolesLoading}
      >
        <Form
          form={rolesForm}
          layout="vertical"
        >
          <Form.Item
            label="Roles"
            name="roleIds"
            tooltip="Select one or more roles for this user"
          >
            <Select
              mode="multiple"
              placeholder="Select roles"
              loading={rolesLoading}
              value={userRoles}
              onChange={(value) => {
                console.log('🔄 Select onChange:', value);
                setUserRoles(value);
                rolesForm.setFieldValue('roleIds', value);
              }}
              options={roles.map((role) => ({
                label: role.name,
                value: role.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Reset Password for ${selectedUser?.username}`}
        open={passwordModalVisible}
        onOk={handlePasswordModalOk}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        okText="Reset Password"
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            label="New Password"
            name="newPassword"
            rules={[
              { required: true, message: 'Please input new password!' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password placeholder="Enter new password (min 6 characters)" />
          </Form.Item>
          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm the password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagementPage;
