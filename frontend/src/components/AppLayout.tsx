import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  UnorderedListOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

/**
 * Application Layout Component
 * Provides navigation and layout structure for authenticated pages
 */

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // User dropdown menu
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: 'Profile',
      icon: <UserOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Sidebar menu items
  const menuItems: MenuProps['items'] = [
    {
      key: '/jobs',
      icon: <UnorderedListOutlined />,
      label: 'Job List',
      onClick: () => navigate('/jobs'),
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: 'Job Logs',
      onClick: () => navigate('/logs'),
    },
    ...(user?.isAdmin
      ? [
          {
            type: 'divider' as const,
          },
          {
            key: 'admin',
            icon: <SettingOutlined />,
            label: 'Administration',
            children: [
              {
                key: '/users',
                label: 'User Management',
                onClick: () => navigate('/users'),
              },
              {
                key: '/roles',
                label: 'Role Management',
                onClick: () => navigate('/roles'),
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'XXL' : 'XXL-Job Enhance'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          }}
        >
          <div />
          <Space size={16}>
            <Space>
              <Text type="secondary">Welcome,</Text>
              <Text strong>{user?.username}</Text>
              {user?.isAdmin && (
                <Text type="warning" style={{ fontSize: 12 }}>
                  (Admin)
                </Text>
              )}
            </Space>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Avatar
                style={{ backgroundColor: '#1890ff', cursor: 'pointer' }}
                icon={<UserOutlined />}
              />
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '24px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
